import { createClient as createSupabase } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { searchTavily } from "@/lib/sources/search";

export type BriefingContent = {
  resumo_executivo: string;
  visao_geral: {
    fundada?: string | null;
    sede?: string | null;
    porte?: string | null;
    modelo_negocio?: string | null;
  };
  produtos: string[];
  lideranca: string[];
  pontos_fortes: string[];
  pontos_fracos: string[];
  oportunidades: string[];
  ameacas: string[];
  posicionamento: string;
  movimentos_recentes: string[];
  identidade_visual: { cores?: string[]; tom?: string | null };
  perguntas_estrategicas: string[];
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

type Market = {
  id: string;
  name: string;
  description: string | null;
};

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  aliases: string[];
};

function buildPrompt(market: Market, competitor: Competitor, tracking: Article[], research: string): string {
  const trackingBlock = tracking.length
    ? tracking
        .slice(0, 20)
        .map((a, i) => `${i + 1}. [${a.source_name}${a.published_at ? ` · ${a.published_at.slice(0, 10)}` : ""}] ${a.title}\n   ${(a.summary || "").slice(0, 240)}\n   URL: ${a.source_url}`)
        .join("\n")
    : "(sem notícias coletadas)";

  return `Você é um analista de inteligência competitiva. Monte um briefing sobre o concorrente abaixo no contexto do mercado indicado. A análise vai guiar decisões estratégicas de produto e posicionamento.

== MERCADO ==
Nome: ${market.name}
${market.description ? `Descrição: ${market.description}` : ""}

== CONCORRENTE ==
Nome: ${competitor.name}
${competitor.website ? `Site: ${competitor.website}` : ""}
${competitor.aliases.length ? `Outros nomes: ${competitor.aliases.join(", ")}` : ""}

== PESQUISA WEB RECENTE ==
${research || "(sem resultados)"}

== NOTÍCIAS MONITORADAS ==
${trackingBlock}

== O QUE RETORNAR ==
Retorne APENAS um JSON válido com a forma EXATA abaixo (sem markdown, sem comentário):

{
  "resumo_executivo": "2-4 parágrafos densos sobre o concorrente neste mercado",
  "visao_geral": {
    "fundada": "ano ou null",
    "sede": "cidade/país ou null",
    "porte": "descrição qualitativa (ex: 'unicórnio', 'pequeno challenger') ou null",
    "modelo_negocio": "como monetiza ou null"
  },
  "produtos": ["produto 1", "produto 2"],
  "lideranca": ["CEO Nome", "CFO Nome"],
  "pontos_fortes": ["ponto 1", "ponto 2", "ponto 3"],
  "pontos_fracos": ["ponto 1", "ponto 2"],
  "oportunidades": ["oportunidade 1"],
  "ameacas": ["ameaça 1"],
  "posicionamento": "1-2 parágrafos sobre como se posiciona vs. outros players do mercado",
  "movimentos_recentes": ["descrição breve 1", "descrição breve 2"],
  "identidade_visual": { "cores": ["#hex", "#hex"], "tom": "descritor curto do tom de comunicação ou null" },
  "perguntas_estrategicas": ["pergunta 1", "pergunta 2", "pergunta 3"],
  "data_quality": 0-100 indicando confiança nos dados
}

Regras:
- Em português do Brasil.
- Seja específico e factual. Prefira "não encontrado" a inventar.
- Se a pesquisa não retornou sinal forte, abaixe o data_quality.
- Movimentos recentes devem citar as notícias acima quando aplicável.
- Nunca retorne texto fora do JSON.`;
}

async function gatherResearch(competitor: Competitor, market: Market): Promise<string> {
  const domain = competitor.website
    ? (() => {
        try {
          return new URL(competitor.website!.startsWith("http") ? competitor.website! : `https://${competitor.website}`).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

  const queries: Promise<{ query: string; results: { title: string; url: string; content: string }[] }>[] = [];
  const mk = (query: string, domains?: string[]) =>
    searchTavily(query, 5, domains, "basic", 60).then((results) => ({
      query,
      results: results.map((r) => ({ title: r.title, url: r.url, content: r.content.slice(0, 300) })),
    }));

  queries.push(mk(`${competitor.name} ${market.name} histórico produtos`));
  queries.push(mk(`${competitor.name} liderança fundadores CEO`));
  queries.push(mk(`${competitor.name} vs concorrentes diferencial`));
  if (domain) queries.push(mk(`${competitor.name} sobre`, [domain]));

  const buckets = await Promise.allSettled(queries);
  const blocks: string[] = [];
  for (const r of buckets) {
    if (r.status !== "fulfilled") continue;
    blocks.push(`--- Busca: ${r.value.query} ---`);
    for (const item of r.value.results) {
      blocks.push(`• ${item.title}\n  ${item.content}\n  ${item.url}`);
    }
  }
  return blocks.join("\n");
}

export async function generateCompetitorBriefing(marketId: string, competitorId: string): Promise<{ briefingId: string }> {
  const svc = serviceClient();

  // Insert briefing row as processing
  const { data: row, error: insertErr } = await svc
    .from("competitor_briefings")
    .insert({ market_id: marketId, competitor_id: competitorId, status: "processing", model_used: MODEL })
    .select()
    .single();
  if (insertErr || !row) throw new Error(insertErr?.message || "Failed to create briefing row");
  const briefingId = row.id;

  try {
    const [{ data: market }, { data: competitor }, { data: articles }] = await Promise.all([
      svc.from("markets").select("id, name, description").eq("id", marketId).single(),
      svc.from("market_competitors").select("id, name, website, aliases").eq("id", competitorId).single(),
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

    const research = await gatherResearch(competitor, market);
    const prompt = buildPrompt(market, competitor, (articles || []) as Article[], research);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const content: BriefingContent = JSON.parse(jsonText);

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
