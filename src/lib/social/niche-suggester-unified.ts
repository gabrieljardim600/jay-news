// Sugestor unificado: a partir de um nicho, retorna em UMA chamada
// (Tavily + Claude) sugestões de voices (Twitter/YouTube/Reddit user),
// crowd (subreddits) e brand targets (IG/FB/Ad Library).
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";

export interface UnifiedVoiceSuggestion {
  type: "voice";
  platform: "twitter" | "youtube" | "reddit_user";
  handle: string;
  label: string;
  category: "analyst" | "economist" | "trader" | "institution" | "other";
  reason: string;
}

export interface UnifiedCrowdSuggestion {
  type: "crowd";
  platform: "reddit" | "stocktwits";
  identifier: string;
  label: string;
  reason: string;
}

export interface UnifiedBrandSuggestion {
  type: "brand";
  label: string;
  instagram_handle?: string;
  facebook_page?: string;
  ad_library_query?: string;
  reason: string;
}

export type UnifiedSuggestion =
  | UnifiedVoiceSuggestion
  | UnifiedCrowdSuggestion
  | UnifiedBrandSuggestion;

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(query: string, max = 6): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: max,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

export async function suggestUnifiedForNiche(
  niche: string,
): Promise<{
  voices: UnifiedVoiceSuggestion[];
  crowd: UnifiedCrowdSuggestion[];
  brands: UnifiedBrandSuggestion[];
}> {
  // 4 queries cobrindo voices, crowd e brands
  const queries = [
    `analistas e influenciadores ${niche} twitter brasil`,
    `principais marcas e concorrentes ${niche} brasil instagram`,
    `subreddit ${niche} comunidade reddit`,
    `youtubers ${niche} canal brasil 2026`,
  ];

  const all: TavilyResult[] = [];
  for (const q of queries) {
    const r = await tavilySearch(q, 5);
    all.push(...r);
  }

  if (all.length === 0) {
    return { voices: [], crowd: [], brands: [] };
  }

  const context = all
    .slice(0, 24)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 250)}`)
    .join("\n\n");

  const prompt = `Você é um analista de inteligência competitiva. A partir dos resultados de busca abaixo sobre o nicho "${niche}", extraia 3 categorias de fontes pra monitorar:

1. VOICES (até 6) — pessoas/perfis curados pra acompanhar.
   Para cada: type:"voice", platform: "twitter"|"youtube"|"reddit_user", handle (sem @), label, category: "analyst"|"economist"|"trader"|"institution"|"other", reason.

2. CROWD (até 4) — comunidades/subreddits.
   Para cada: type:"crowd", platform: "reddit"|"stocktwits", identifier (formato "r/nome" pra Reddit, ticker pra StockTwits), label, reason.

3. BRANDS (até 6) — marcas/concorrentes pra espionagem.
   Para cada: type:"brand", label, instagram_handle (opcional, sem @), facebook_page (opcional), ad_library_query (opcional, termo de busca), reason.

Resultados de busca:
${context}

Responda APENAS com JSON puro nesse formato:
{
  "voices": [...],
  "crowd": [...],
  "brands": [...]
}

Não invente handles. Se não tiver dado suficiente pra um campo, omita-o. Se não encontrar nada pra uma categoria, retorne array vazio.`;

  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  try {
    const parsed = extractJson<{
      voices?: UnifiedVoiceSuggestion[];
      crowd?: UnifiedCrowdSuggestion[];
      brands?: UnifiedBrandSuggestion[];
    }>(text);
    return {
      voices: parsed.voices ?? [],
      crowd: parsed.crowd ?? [],
      brands: parsed.brands ?? [],
    };
  } catch {
    return { voices: [], crowd: [], brands: [] };
  }
}
