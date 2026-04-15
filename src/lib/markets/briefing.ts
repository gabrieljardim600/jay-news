import { createClient as createSupabase } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";
import { runResearch, renderForPrompt, mergeHints, type ModuleRunResult } from "./research/runner";
import type { ResearchCompetitor, ResearchMarket } from "./research/types";
import { runProfileBriefing } from "./briefing-profiles/synth";
import type { BriefingProfile } from "./briefing-profiles/service";

export type BriefingContent = {
  resumo_executivo: string;
  visao_geral: {
    fundada?: string | null;
    sede?: string | null;
    porte?: string | null;
    modelo_negocio?: string | null;
    setor?: string | null;
    ticker?: string | null;
    receita?: string | null;
    funcionarios?: string | null;
    cnpj?: string | null;
  };
  produtos: string[];
  lideranca: string[];
  estrutura_acionaria?: string | null;
  pontos_fortes: string[];
  pontos_fracos: string[];
  oportunidades: string[];
  ameacas: string[];
  posicionamento: string;
  movimentos_recentes: string[];
  identidade_visual: { cores?: string[]; tom?: string | null; logo_url?: string | null };
  perguntas_estrategicas: string[];
  reputacao?: { reclame_aqui_score?: number | null; reclame_aqui_total?: number | null; resolved_pct?: number | null } | null;
  data_quality: number;
};

const MODEL = "claude-sonnet-4-6";

function serviceClient() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Article = {
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  published_at: string | null;
};

function buildPrompt(
  market: ResearchMarket,
  competitor: ResearchCompetitor,
  tracking: Article[],
  researchText: string,
  knownColors: string[],
  logoHint: string | null,
): string {
  const trackingBlock = tracking.length
    ? tracking
        .slice(0, 20)
        .map((a, i) => `${i + 1}. [${a.source_name}${a.published_at ? ` · ${a.published_at.slice(0, 10)}` : ""}] ${a.title}\n   ${(a.summary || "").slice(0, 240)}\n   URL: ${a.source_url}`)
        .join("\n")
    : "(sem notícias coletadas)";

  return `Você é um analista sênior de inteligência competitiva. Produza um briefing denso, factual e acionável sobre o concorrente, baseando-se nas fontes abaixo. Cada seção traz dados de APIs/scrapers diferentes — trate como evidências independentes para triangular fatos.

== MERCADO ==
Nome: ${market.name}
${market.description ? `Descrição: ${market.description}` : ""}

== CONCORRENTE ==
Nome: ${competitor.name}
${competitor.website ? `Site: ${competitor.website}` : ""}
${competitor.aliases.length ? `Outros nomes: ${competitor.aliases.join(", ")}` : ""}
${competitor.cnpj ? `CNPJ: ${competitor.cnpj}` : ""}

${knownColors.length ? `== CORES DETECTADAS NO SITE / META ==\n${knownColors.join(", ")}\nEstas cores vêm do CSS real do site ou de meta tags oficiais. Use-as como base de verdade na identidade visual e NÃO chute cor pelo nome da empresa.\n` : ""}
${logoHint ? `== LOGO OFICIAL ==\n${logoHint}\nCopie esta URL em identidade_visual.logo_url.\n` : ""}

== DADOS DE PESQUISA ==
${researchText || "(sem dados)"}

== NOTÍCIAS MONITORADAS ==
${trackingBlock}

== O QUE RETORNAR ==
Use TODOS os módulos acima — dados oficiais (CVM, BACEN, BrasilAPI) são base de verdade; pesquisa web e Wikipedia complementam. Para empresas listadas, inclua ticker + setor. Para empresas reguladas (IF/IP), cite a autorização BACEN.

Retorne APENAS um JSON válido com a forma EXATA abaixo (sem markdown, sem comentário):

{
  "resumo_executivo": "3-5 parágrafos densos",
  "visao_geral": {
    "fundada": "ano ou null",
    "sede": "cidade, estado/país ou null",
    "porte": "qualitativo + quantitativo",
    "modelo_negocio": "como monetiza",
    "setor": "setor primário + secundário",
    "ticker": "TICKER - bolsa (se listada)",
    "receita": "receita anual + ano OU market cap",
    "funcionarios": "~número + ano",
    "cnpj": "CNPJ se disponível"
  },
  "produtos": ["produto — 1 linha de contexto"],
  "lideranca": ["Nome — Cargo (desde ano)"],
  "estrutura_acionaria": "controladores / free float, ou null",
  "pontos_fortes": ["específico e factual"],
  "pontos_fracos": ["específico"],
  "oportunidades": ["…"],
  "ameacas": ["…"],
  "posicionamento": "1-2 parágrafos citando concorrentes por nome",
  "movimentos_recentes": ["AAAA-MM: movimento (fonte: …)"],
  "identidade_visual": { "cores": ["#hex"], "tom": "…", "logo_url": "…" },
  "perguntas_estrategicas": ["…"],
  "reputacao": { "reclame_aqui_score": 0, "reclame_aqui_total": 0, "resolved_pct": 0 },
  "data_quality": 0-100
}

Regras:
- Em português do Brasil.
- Prefira "não encontrado" a inventar. Nunca invente CEO, ticker, CNPJ, valores.
- Cores: use APENAS as detectadas; se não houver, deixe array vazio.
- Logo: copie a URL do LOGO OFICIAL acima.
- Movimentos com data + fonte entre parênteses.
- Nunca retorne texto fora do JSON.`;
}

export async function generateCompetitorBriefing(
  marketId: string,
  competitorId: string,
  opts?: { profileId?: string },
): Promise<{ briefingId: string }> {
  const svc = serviceClient();

  // Resolve optional profile (service-role client bypasses RLS, so we must
  // scope to the owner of the market).
  let profile: BriefingProfile | null = null;
  if (opts?.profileId) {
    const { data: marketRow } = await svc.from("markets").select("user_id").eq("id", marketId).single();
    if (marketRow?.user_id) {
      const { data: prof } = await svc
        .from("briefing_profiles")
        .select("*")
        .eq("id", opts.profileId)
        .eq("user_id", marketRow.user_id)
        .maybeSingle();
      profile = (prof as BriefingProfile | null) ?? null;
    }
  }

  const { data: row, error: insertErr } = await svc
    .from("competitor_briefings")
    .insert({
      market_id: marketId,
      competitor_id: competitorId,
      status: "processing",
      model_used: MODEL,
      profile_slug: profile?.slug ?? null,
      profile_label: profile?.label ?? null,
    })
    .select()
    .single();
  if (insertErr || !row) throw new Error(insertErr?.message || "Failed to create briefing row");
  const briefingId = row.id;

  try {
    const [{ data: market }, { data: competitor }, { data: articles }] = await Promise.all([
      svc.from("markets").select("id, name, description, language, research_modules").eq("id", marketId).single(),
      svc.from("market_competitors").select("id, name, website, aliases, cnpj").eq("id", competitorId).single(),
      svc
        .from("market_articles")
        .select("title, source_name, source_url, summary, published_at")
        .eq("market_id", marketId)
        .contains("mentioned_competitor_ids", [competitorId])
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(25),
    ]);
    if (!market) throw new Error("Market not found");
    if (!competitor) throw new Error("Competitor not found");

    // Profile-driven briefing — use focused modules + custom prompt/schema
    if (profile) {
      const result = await runProfileBriefing({
        profile,
        competitor: competitor as ResearchCompetitor,
        market: market as ResearchMarket,
      });
      await svc
        .from("competitor_briefings")
        .update({
          status: "completed",
          content: { profile: result.profile, sections: result.sections, body: result.content },
          resumo: null,
          data_quality: null,
          articles_analyzed: articles?.length ?? 0,
          finished_at: new Date().toISOString(),
        })
        .eq("id", briefingId);
      return { briefingId };
    }

    const runs: ModuleRunResult[] = await runResearch({
      moduleIds: market.research_modules ?? ["core"],
      competitor: competitor as ResearchCompetitor,
      market: market as ResearchMarket,
    });

    const hints = mergeHints(runs);
    const researchText = renderForPrompt(runs);

    const prompt = buildPrompt(
      market as ResearchMarket,
      competitor as ResearchCompetitor,
      (articles || []) as Article[],
      researchText,
      hints.colors ?? [],
      hints.logo_url ?? null,
    );

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const content = extractJson<BriefingContent>(text);

    // Safety-net: merge hints into visao_geral / identidade_visual / reputacao
    if (!content.identidade_visual) content.identidade_visual = {};
    if (hints.logo_url && !content.identidade_visual.logo_url) content.identidade_visual.logo_url = hints.logo_url;
    if (hints.colors && hints.colors.length > 0) {
      const claudeColors = content.identidade_visual.cores || [];
      const hasAnyDetected = claudeColors.some((c) => hints.colors!.includes(c.toLowerCase()));
      if (claudeColors.length === 0 || !hasAnyDetected) {
        content.identidade_visual.cores = hints.colors.slice(0, 4);
      }
    }
    if (!content.visao_geral) content.visao_geral = {};
    if (hints.ticker && !content.visao_geral.ticker) content.visao_geral.ticker = hints.ticker;
    if (hints.cnpj && !content.visao_geral.cnpj) content.visao_geral.cnpj = hints.cnpj;

    if (hints.reclame_aqui && (hints.reclame_aqui.score != null || hints.reclame_aqui.total != null)) {
      content.reputacao = {
        reclame_aqui_score: hints.reclame_aqui.score ?? null,
        reclame_aqui_total: hints.reclame_aqui.total ?? null,
        resolved_pct: hints.reclame_aqui.resolved_pct ?? null,
      };
    }

    await svc
      .from("competitor_briefings")
      .update({
        status: "completed",
        content,
        resumo: content.resumo_executivo?.slice(0, 1000) ?? null,
        data_quality: typeof content.data_quality === "number" ? Math.round(content.data_quality) : null,
        articles_analyzed: articles?.length ?? 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", briefingId);

    return { briefingId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc
      .from("competitor_briefings")
      .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
      .eq("id", briefingId);
    throw e;
  }
}
