import { createClient as createSupabase } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";
import { searchTavily } from "@/lib/sources/search";
import { fetchWikipediaSummary, fetchWikipediaExtract } from "./research/wikipedia";
import { fetchWebsiteMeta } from "./research/website";
import { lookupPublicCompany, formatBrapiForPrompt, type BrapiQuote } from "./research/brapi";

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

function buildPrompt(
  market: Market,
  competitor: Competitor,
  tracking: Article[],
  research: string,
  wikipedia: string | null,
  website: string | null,
  brapi: BrapiQuote | null,
  knownColors: string[],
  logoHint: string | null,
): string {
  const trackingBlock = tracking.length
    ? tracking
        .slice(0, 20)
        .map((a, i) => `${i + 1}. [${a.source_name}${a.published_at ? ` · ${a.published_at.slice(0, 10)}` : ""}] ${a.title}\n   ${(a.summary || "").slice(0, 240)}\n   URL: ${a.source_url}`)
        .join("\n")
    : "(sem notícias coletadas)";

  return `Você é um analista sênior de inteligência competitiva. Produza um briefing denso, factual e acionável sobre o concorrente. A análise vai embasar decisões estratégicas de produto, posicionamento e resposta competitiva.

== MERCADO ==
Nome: ${market.name}
${market.description ? `Descrição: ${market.description}` : ""}

== CONCORRENTE ==
Nome: ${competitor.name}
${competitor.website ? `Site: ${competitor.website}` : ""}
${competitor.aliases.length ? `Outros nomes: ${competitor.aliases.join(", ")}` : ""}

${brapi ? `== B3 / BRAPI (empresa listada) ==\n${formatBrapiForPrompt(brapi)}\nEstes dados vêm de API pública — use como base de verdade para ticker, setor, valor de mercado e funcionários.\n` : ""}
${wikipedia ? `== WIKIPEDIA (PT-BR) ==\n${wikipedia}\n` : ""}
${website ? `== DADOS DO SITE OFICIAL ==\n${website}\n` : ""}
${knownColors.length ? `== CORES DETECTADAS NO SITE (CSS/meta) ==\n${knownColors.join(", ")}\nUse estas cores como base de verdade para a identidade visual. Não invente cores diferentes das observadas.\n` : ""}
${logoHint ? `== LOGO OFICIAL (og:image / thumbnail) ==\n${logoHint}\n` : ""}

== PESQUISA WEB RECENTE ==
${research || "(sem resultados)"}

== NOTÍCIAS MONITORADAS ==
${trackingBlock}

== INSTRUÇÕES ==
Use TODAS as fontes acima — Wikipedia é base confiável para dados históricos, site oficial para produtos/tom, pesquisa web para dados recentes, notícias para movimentos. Para empresas listadas na bolsa, inclua ticker (ex: CIEL3, STNE, PAGS) e setor (ex: "meios de pagamento - listada B3").

Retorne APENAS um JSON válido com a forma EXATA abaixo (sem markdown, sem comentário):

{
  "resumo_executivo": "3-5 parágrafos densos cobrindo história, modelo, posição no mercado e contexto atual",
  "visao_geral": {
    "fundada": "ano (ex: '1995') ou null",
    "sede": "cidade, estado/país ou null",
    "porte": "qualitativo (ex: 'líder consolidado', 'unicórnio') + quantitativo se souber",
    "modelo_negocio": "como monetiza (ex: 'MDR sobre transações + aluguel de POS') ou null",
    "setor": "setor primário + secundário se aplicável ou null",
    "ticker": "ticker + bolsa (ex: 'CIEL3 - B3') se empresa listada, senão null",
    "receita": "receita anual recente + ano ou null",
    "funcionarios": "número aproximado + ano ou null"
  },
  "produtos": ["produto/linha 1 com 1 linha de contexto", "produto 2"],
  "lideranca": ["Nome Sobrenome — Cargo (desde ano)", "Nome — Cargo"],
  "estrutura_acionaria": "controladores principais / free float / controlador estatal, quando aplicável; null se desconhecido",
  "pontos_fortes": ["ponto específico e factual 1", "ponto 2", "ponto 3"],
  "pontos_fracos": ["ponto 1", "ponto 2"],
  "oportunidades": ["oportunidade de mercado 1"],
  "ameacas": ["ameaça competitiva/regulatória 1"],
  "posicionamento": "1-2 parágrafos sobre posição vs. outros players do mercado (cite concorrentes por nome)",
  "movimentos_recentes": ["movimento 1 com data (ex: '2025-03: lançou X')", "movimento 2"],
  "identidade_visual": {
    "cores": ["#hex", "#hex"],
    "tom": "descritor do tom (ex: 'institucional e corporativo', 'jovem e direto') ou null",
    "logo_url": "URL do logo oficial se houver (copie do campo LOGO OFICIAL acima) ou null"
  },
  "perguntas_estrategicas": ["pergunta 1 para entender ameaça/oportunidade", "pergunta 2", "pergunta 3"],
  "data_quality": 0-100 (quanto das fontes trouxe sinal forte, factual e específico)
}

Regras:
- Em português do Brasil.
- Seja específico e factual. Prefira "não encontrado" a inventar — nunca invente nomes de CEOs, tickers ou valores.
- Identidade visual: SE houver cores detectadas no site, use-as. NUNCA chute cor só pelo nome da empresa.
- Logo: se o LOGO OFICIAL foi fornecido, copie a URL tal qual no campo "logo_url".
- Movimentos recentes devem citar data + fonte quando aplicável.
- Para empresas públicas (tem ticker), sempre preencher setor, receita e estrutura_acionaria.
- Nunca retorne texto fora do JSON.`;
}

type DeepResearch = {
  tavily: string;
  wikipedia: string | null;
  website: string | null;
  brapi: BrapiQuote | null;
  detectedColors: string[];
  logoUrl: string | null;
};

async function gatherResearch(competitor: Competitor, market: Market): Promise<DeepResearch> {
  const domain = competitor.website
    ? (() => {
        try {
          return new URL(competitor.website!.startsWith("http") ? competitor.website! : `https://${competitor.website}`).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

  // ── Tavily multi-query
  const queries: Promise<{ query: string; results: { title: string; url: string; content: string }[] }>[] = [];
  const mk = (query: string, domains?: string[]) =>
    searchTavily(query, 5, domains, "basic", 60).then((results) => ({
      query,
      results: results.map((r) => ({ title: r.title, url: r.url, content: r.content.slice(0, 300) })),
    }));

  queries.push(mk(`${competitor.name} ${market.name} histórico produtos receita`));
  queries.push(mk(`${competitor.name} CEO diretoria executiva presidente`));
  queries.push(mk(`${competitor.name} vs concorrentes diferencial posicionamento`));
  queries.push(mk(`${competitor.name} ações ticker bolsa B3 resultado trimestre`));
  // Target RI / CVM sources for leadership data on public companies
  queries.push(mk(
    `${competitor.name} administração diretoria conselho`,
    ["cvm.gov.br", "b3.com.br", "br.investing.com", "economatica.com", "valor.globo.com", "infomoney.com.br"],
  ));
  if (domain) queries.push(mk(`${competitor.name} sobre institucional`, [domain]));

  // ── Wikipedia PT-BR + website scrape + brapi lookup in parallel
  const [tavilyBuckets, wikipediaSummary, wikipediaExtract, websiteMeta, brapi] = await Promise.all([
    Promise.allSettled(queries),
    fetchWikipediaSummary(competitor.name),
    fetchWikipediaExtract(competitor.name, 3500),
    competitor.website ? fetchWebsiteMeta(competitor.website) : Promise.resolve(null),
    lookupPublicCompany(competitor.name),
  ]);

  const tavilyBlocks: string[] = [];
  for (const r of tavilyBuckets) {
    if (r.status !== "fulfilled") continue;
    tavilyBlocks.push(`--- Busca: ${r.value.query} ---`);
    for (const item of r.value.results) {
      tavilyBlocks.push(`• ${item.title}\n  ${item.content}\n  ${item.url}`);
    }
  }

  const wikipediaBlock = wikipediaExtract || wikipediaSummary?.extract
    ? [
        wikipediaSummary ? `Título: ${wikipediaSummary.title}${wikipediaSummary.description ? ` (${wikipediaSummary.description})` : ""}\nURL: ${wikipediaSummary.url}` : null,
        wikipediaExtract || wikipediaSummary?.extract || null,
      ].filter(Boolean).join("\n\n")
    : null;

  const websiteBlock = websiteMeta
    ? [
        websiteMeta.title ? `Title: ${websiteMeta.title}` : null,
        websiteMeta.description ? `Meta description: ${websiteMeta.description}` : null,
        websiteMeta.headline ? `Headline H1: ${websiteMeta.headline}` : null,
        websiteMeta.themeColor ? `Theme color (meta): ${websiteMeta.themeColor}` : null,
        websiteMeta.bodySnippet ? `Conteúdo inicial: ${websiteMeta.bodySnippet}` : null,
      ].filter(Boolean).join("\n")
    : null;

  const detectedColors = [
    ...(websiteMeta?.themeColor ? [websiteMeta.themeColor] : []),
    ...(websiteMeta?.detectedColors ?? []),
  ].filter((c, i, a) => a.indexOf(c) === i);

  return {
    tavily: tavilyBlocks.join("\n"),
    wikipedia: wikipediaBlock,
    website: websiteBlock,
    brapi,
    detectedColors,
    logoUrl: websiteMeta?.ogImage ?? brapi?.logoUrl ?? wikipediaSummary?.originalImage ?? null,
  };
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
    const prompt = buildPrompt(
      market,
      competitor,
      (articles || []) as Article[],
      research.tavily,
      research.wikipedia,
      research.website,
      research.brapi,
      research.detectedColors,
      research.logoUrl,
    );

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const content = extractJson<BriefingContent>(text);

    // Safety net: preserve scraped/API data even if Claude drops or guesses.
    if (!content.identidade_visual) content.identidade_visual = {};
    if (research.logoUrl && !content.identidade_visual.logo_url) {
      content.identidade_visual.logo_url = research.logoUrl;
    }
    if (research.detectedColors.length > 0) {
      const claudeColors = content.identidade_visual.cores || [];
      const hasAnyDetected = claudeColors.some((c) => research.detectedColors.includes(c.toLowerCase()));
      if (claudeColors.length === 0 || !hasAnyDetected) {
        content.identidade_visual.cores = research.detectedColors.slice(0, 4);
      }
    }
    if (research.brapi) {
      if (!content.visao_geral) content.visao_geral = {};
      if (!content.visao_geral.ticker) content.visao_geral.ticker = `${research.brapi.ticker} - B3`;
      if (!content.visao_geral.setor && research.brapi.sector) {
        content.visao_geral.setor = research.brapi.industry
          ? `${research.brapi.sector} · ${research.brapi.industry}`
          : research.brapi.sector;
      }
      if (!content.visao_geral.funcionarios && research.brapi.employees) {
        content.visao_geral.funcionarios = `~${research.brapi.employees.toLocaleString("pt-BR")}`;
      }
      if (!content.visao_geral.receita && research.brapi.marketCap) {
        const mc = research.brapi.marketCap;
        content.visao_geral.receita = mc >= 1e9
          ? `Market cap: R$ ${(mc / 1e9).toFixed(2)}bi`
          : `Market cap: R$ ${(mc / 1e6).toFixed(0)}mi`;
      }
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
