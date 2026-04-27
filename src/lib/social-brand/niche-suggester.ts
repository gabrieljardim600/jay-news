// Sugere handles de Instagram + Facebook + Pages do Ad Library para um nicho.
// Estratégia: Tavily search + Claude para extrair handles candidatos.
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";

export interface NicheSuggestion {
  label: string;
  instagram_handle?: string;
  facebook_page?: string;
  ad_library_query?: string;
  reason: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(query: string, max = 8): Promise<TavilyResult[]> {
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

export async function suggestForNiche(niche: string, max = 8): Promise<NicheSuggestion[]> {
  const queries = [
    `principais marcas e concorrentes ${niche} brasil instagram`,
    `top ${niche} empresas redes sociais 2026`,
    `${niche} site:instagram.com OR site:facebook.com`,
  ];
  const all: TavilyResult[] = [];
  for (const q of queries) {
    const r = await tavilySearch(q, 6);
    all.push(...r);
  }

  if (all.length === 0) return [];

  const context = all
    .slice(0, 18)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 280)}`)
    .join("\n\n");

  const prompt = `Você é um analista de inteligência competitiva. A partir dos resultados de busca abaixo sobre o nicho "${niche}", extraia até ${max} marcas/concorrentes relevantes para serem monitoradas.

Para cada marca, identifique:
- label: nome legível
- instagram_handle: handle do Instagram sem @ (apenas se contas Business/Creator pública)
- facebook_page: slug ou ID da página do Facebook
- ad_library_query: nome a usar como search_terms na Meta Ad Library
- reason: 1 frase explicando por que é relevante

Resultados de busca:
${context}

Responda APENAS com JSON no formato:
{"suggestions":[{"label":"...","instagram_handle":"...","facebook_page":"...","ad_library_query":"...","reason":"..."}]}

Se não houver dados suficientes para algum campo, omita-o. Não invente handles.`;

  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  try {
    const json = extractJson<{ suggestions: NicheSuggestion[] }>(text);
    return json?.suggestions ?? [];
  } catch {
    return [];
  }
}
