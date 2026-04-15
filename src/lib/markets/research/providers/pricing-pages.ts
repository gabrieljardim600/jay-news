import type { ResearchProvider } from "../types";

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { return new URL(raw.startsWith("http") ? raw : `https://${raw}`).toString(); } catch { return null; }
}

const CANDIDATE_PATHS = [
  "/precos", "/preco", "/planos", "/plano", "/taxas", "/tarifas", "/fees",
  "/produtos", "/produto", "/maquininhas", "/maquininha", "/solucoes", "/solucao",
  "/antecipacao", "/credito", "/conta", "/checkout", "/ecommerce", "/link-de-pagamento",
  "/stone", "/cielo", "/pagbank", "/rede",
  "/pricing", "/plans",
];

/** Faz um crawl curto das páginas comerciais mais comuns do site oficial
 *  (preços, planos, taxas, produtos, maquininhas) para extrair conteúdo
 *  textual relevante. É complementar ao website-provider, que olha só a home. */
export const pricingPagesProvider: ResearchProvider = {
  id: "pricing-pages",
  label: "Site oficial — preços & produtos",
  description: "Crawl direcionado de /precos, /planos, /taxas, /produtos, /maquininhas.",
  searchLike: false,
  enabled: (c) => !!normalizeUrl(c.website),
  async fetch(competitor) {
    const base = normalizeUrl(competitor.website);
    if (!base) return null;
    const baseUrl = new URL(base);
    const origin = baseUrl.origin;

    const toCheck = CANDIDATE_PATHS.map((p) => `${origin}${p}`);
    const results = await Promise.allSettled(toCheck.map((url) =>
      fetch(url, {
        signal: AbortSignal.timeout(6_000),
        headers: { "User-Agent": "JNews/1.0 (+competitive-intel)" },
        redirect: "follow",
      }).then(async (r) => {
        if (!r.ok) return null;
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("text/html")) return null;
        const html = (await r.text()).slice(0, 120_000);
        return { url: r.url, html };
      }).catch(() => null),
    ));

    const hits: Array<{ url: string; excerpt: string; priceMatches: string[] }> = [];
    for (const res of results) {
      if (res.status !== "fulfilled" || !res.value) continue;
      const { url, html } = res.value;
      // strip html tags, collapse whitespace
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 160) continue;

      // Extract price-like snippets
      const priceRe = /(R\$\s?\d{1,3}(?:[\.,]\d{2,3})*(?:[\.,]\d{2})?|\d+[,\.]\d+\s?%|\d+(?:[\.,]\d+)?\s?%)/gi;
      const priceMatches = Array.from(new Set(text.match(priceRe) ?? [])).slice(0, 12);

      // Headings + first chunk of content
      const headingsRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
      const heads: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = headingsRe.exec(html))) {
        const t = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (t && t.length < 140) heads.push(t);
        if (heads.length >= 8) break;
      }

      const excerpt = [
        heads.length ? `Títulos: ${heads.join(" · ")}` : "",
        `Trecho: ${text.slice(0, 600)}`,
      ].filter(Boolean).join("\n  ");
      hits.push({ url, excerpt, priceMatches });
    }

    if (hits.length === 0) return null;
    const lines = hits.slice(0, 8).map((h) => {
      const prices = h.priceMatches.length ? `  Valores citados: ${h.priceMatches.join(", ")}\n` : "";
      return `• ${h.url}\n  ${h.excerpt}\n${prices}`.trimEnd();
    });
    return { providerId: this.id, label: "Site oficial — páginas comerciais", text: lines.join("\n") };
  },
};
