import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

const API_KEY_HEADER = "APIKey ";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const COMMON_TRIBUNAIS = [
  "tjsp", "tjrj", "tjmg", "tjrs", "trf3", "trf2", "trf1", "stj",
];

async function queryTribunal(tribunal: string, term: string, apiKey: string, controller: AbortSignal): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${DATAJUD_BASE}/api_publica_${tribunal}/_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: API_KEY_HEADER + apiKey },
      signal: controller,
      body: JSON.stringify({
        size: 10,
        query: {
          multi_match: {
            query: term,
            fields: ["partes.nome", "classe.nome", "assuntos.nome"],
          },
        },
        sort: [{ dataAjuizamento: { order: "desc" } }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } };
    return data.hits?.hits?.map((h) => h._source).filter(Boolean) as unknown[] || [];
  } catch { return null; }
}

/** DataJud (CNJ) — processos judiciais públicos. Quando DATAJUD_API_KEY estiver
 *  setada, consulta direto a Elasticsearch pública; caso contrário, faz fallback
 *  Tavily-targetado nos domínios oficiais. */
export const datajudCnjProvider: ResearchProvider = {
  id: "datajud-cnj",
  label: "DataJud — CNJ",
  description: "Processos judiciais públicos consolidados pelo CNJ.",
  searchLike: true,
  enabled: (_c, m) => m.language === "pt-BR",
  async fetch(competitor) {
    const key = process.env.DATAJUD_API_KEY;
    if (key) {
      const ctrl = AbortSignal.timeout(10_000);
      const results = await Promise.allSettled(
        COMMON_TRIBUNAIS.map((t) => queryTribunal(t, competitor.name, key, ctrl)),
      );
      const hits: Array<{ source: Record<string, unknown>; tribunal: string }> = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          for (const src of r.value) hits.push({ source: src as Record<string, unknown>, tribunal: COMMON_TRIBUNAIS[i] });
        }
      });
      if (hits.length > 0) {
        const lines = hits.slice(0, 30).map((h) => {
          const s = h.source;
          const classe = (s.classe as { nome?: string } | undefined)?.nome || "?";
          const assuntos = Array.isArray(s.assuntos) ? (s.assuntos as Array<{ nome?: string }>).map((a) => a?.nome).filter(Boolean).slice(0, 2).join(" · ") : "";
          const data = typeof s.dataAjuizamento === "string" ? (s.dataAjuizamento as string).slice(0, 10) : "";
          return `• [${h.tribunal.toUpperCase()}${data ? ` · ${data}` : ""}] ${classe}${assuntos ? ` — ${assuntos}` : ""}\n  processo: ${s.numeroProcesso ?? "?"}`;
        });
        return { providerId: this.id, label: "DataJud (CNJ) — processos", text: lines.join("\n") };
      }
    }
    // Fallback via Tavily
    if (!process.env.TAVILY_API_KEY) return null;
    const results = await searchTavily(`${competitor.name} processo`, 8, ["datajud.cnj.jus.br", "cnj.jus.br"], "basic", 365);
    if (results.length === 0) return null;
    const lines = results.map((r) => `• ${r.title}\n  ${r.content.slice(0, 260)}\n  ${r.url}`);
    return { providerId: this.id, label: "DataJud (CNJ) — processos (via Tavily)", text: lines.join("\n") };
  },
};
