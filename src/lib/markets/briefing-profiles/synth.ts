import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";
import { runResearch, renderForPrompt, mergeHints, type ModuleRunResult } from "@/lib/markets/research/runner";
import type { ResearchCompetitor, ResearchMarket } from "@/lib/markets/research/types";
import type { RelevanceOptions } from "@/lib/markets/research/relevance";
import type { BriefingProfile } from "./service";
import type { OutputSection } from "./defaults";

const MODEL = "claude-sonnet-4-6";

export type ProfileBriefingResult = {
  profile: { id: string; slug: string; label: string };
  entity: { name: string; website?: string | null; cnpj?: string | null };
  sections: OutputSection[];
  content: Record<string, unknown>;      // keyed by section.id
  modules: ModuleRunResult[];            // raw research for transparency
  hints: ReturnType<typeof mergeHints>;
  modelUsed: string;
  durationMs: number;
};

function buildPrompt(profile: BriefingProfile, competitor: ResearchCompetitor, market: ResearchMarket, researchText: string, hints: ReturnType<typeof mergeHints>): string {
  const schemaLines = profile.output_sections.map((s) => {
    const shape = s.kind === "list" ? '["..."]' : s.kind === "keyvalue" ? '{ "chave": "valor" }' : '"texto denso"';
    return `  "${s.id}": ${shape}${s.hint ? `  // ${s.hint}` : ""}`;
  }).join(",\n");
  const hintsBlock = [
    hints.colors?.length ? `Cores detectadas: ${hints.colors.join(", ")}` : null,
    hints.logo_url ? `Logo oficial: ${hints.logo_url}` : null,
    hints.ticker ? `Ticker: ${hints.ticker}` : null,
    hints.cnpj ? `CNPJ: ${hints.cnpj}` : null,
  ].filter(Boolean).join("\n");

  return `${profile.synth_prompt}

== CONTEXTO ==
Alvo: ${competitor.name}
${competitor.website ? `Site: ${competitor.website}` : ""}
${competitor.cnpj ? `CNPJ: ${competitor.cnpj}` : ""}
${competitor.aliases.length ? `Outros nomes: ${competitor.aliases.join(", ")}` : ""}
Mercado: ${market.name}${market.description ? ` — ${market.description}` : ""}
${hintsBlock ? `\n== SINAIS DETECTADOS ==\n${hintsBlock}\n` : ""}
== DADOS DE PESQUISA ==
${researchText || "(sem dados)"}

== FORMATO DE SAÍDA ==
Retorne APENAS um JSON válido (sem markdown, sem prefixo) com esta forma:

{
${schemaLines}
}

Regras:
- Em português do Brasil.
- Prefira "não encontrado" a inventar. Nunca chute CEO, ticker, CNPJ, valores.
- Cite fontes entre parênteses quando possível (ex.: "Receita Federal", "CVM FRE", "Reclame Aqui").
- Para listas, cada item deve ser específico e factual — nada genérico.
- Não adicione chaves além das especificadas.`;
}

export type RunProfileOptions = {
  profile: BriefingProfile;
  competitor: ResearchCompetitor;
  market: ResearchMarket;
  relevance?: RelevanceOptions;
  forceRefresh?: boolean;
};

export async function runProfileBriefing(opts: RunProfileOptions): Promise<ProfileBriefingResult> {
  const started = Date.now();
  const runs = await runResearch({
    moduleIds: opts.profile.module_ids,
    competitor: opts.competitor,
    market: opts.market,
    relevance: opts.relevance,
    forceRefresh: opts.forceRefresh,
  });
  const hints = mergeHints(runs);
  const researchText = renderForPrompt(runs);

  const prompt = buildPrompt(opts.profile, opts.competitor, opts.market, researchText, hints);
  const client = getAnthropicClient();
  // Token budget escala com o nº de seções: perfis com 15 seções (Subadquirência
  // BR) não cabem em 6000 e o Claude trunca o JSON. ~1200 tokens por seção
  // cobre com folga, mínimo 8000, máximo 24000.
  const maxTokens = Math.max(8000, Math.min(24000, 1200 * (opts.profile.output_sections.length || 6)));
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const stopReason = (response as unknown as { stop_reason?: string }).stop_reason;
  if (stopReason === "max_tokens") {
    console.warn(`[synth] Claude atingiu max_tokens=${maxTokens} no perfil ${opts.profile.slug} — JSON pode estar truncado; parser tolerante vai tentar recuperar.`);
  }
  const content = extractJson<Record<string, unknown>>(text);

  return {
    profile: { id: opts.profile.id, slug: opts.profile.slug, label: opts.profile.label },
    entity: { name: opts.competitor.name, website: opts.competitor.website, cnpj: opts.competitor.cnpj },
    sections: opts.profile.output_sections,
    content,
    modules: runs,
    hints,
    modelUsed: MODEL,
    durationMs: Date.now() - started,
  };
}
