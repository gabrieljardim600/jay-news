import type { ResearchProvider, ResearchCompetitor } from "../types";

/**
 * Providers que batem em APIs reais (não Tavily).
 * Todos são tolerantes a falha — devolvem null se algo quebrar.
 */

const UA = "JNews/1.0 (+competitive-intel)";
const TIMEOUT_MS = 8000;

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers || {}) },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(init?.headers || {}) },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function hostFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────── */
/* 1. crt.sh — Certificate Transparency logs                   */
/* ────────────────────────────────────────────────────────── */
export const crtShProvider: ResearchProvider = {
  id: "crt-sh",
  label: "crt.sh — Certificate Transparency",
  description: "Subdomínios descobertos via certificados SSL emitidos.",
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const url = `https://crt.sh/?q=%25.${encodeURIComponent(host)}&output=json`;
    const data = await fetchJson<Array<{ name_value: string; issuer_name?: string; not_before?: string }>>(url);
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const names = new Set<string>();
    for (const row of data) {
      for (const n of (row.name_value || "").split(/\n/)) {
        const clean = n.trim().toLowerCase().replace(/^\*\./, "");
        if (clean && clean.endsWith(host)) names.add(clean);
      }
    }
    const sorted = [...names].sort().slice(0, 60);
    if (sorted.length === 0) return null;
    const text = `Subdomínios ativos/históricos (CT logs):\n${sorted.map((n) => `• ${n}`).join("\n")}`;
    return { providerId: this.id, label: "Certificate Transparency (crt.sh)", text };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 2. Hacker News Algolia                                      */
/* ────────────────────────────────────────────────────────── */
export const hnAlgoliaProvider: ResearchProvider = {
  id: "hn-algolia",
  label: "Hacker News (Algolia)",
  description: "Discussões, lançamentos e comentários sobre a marca no HN.",
  searchLike: true,
  enabled: () => true,
  async fetch(competitor) {
    const q = encodeURIComponent(competitor.name);
    const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=(story,comment)&hitsPerPage=10`;
    const data = await fetchJson<{ hits: Array<{ title?: string; story_title?: string; url?: string; objectID: string; points?: number; num_comments?: number; created_at?: string }> }>(url);
    if (!data || !data.hits?.length) return null;
    const lines = data.hits.map((h) => {
      const title = h.title || h.story_title || "(comentário)";
      const pts = h.points != null ? ` · ${h.points} pts` : "";
      const cmts = h.num_comments != null ? ` · ${h.num_comments} coment.` : "";
      const date = h.created_at?.slice(0, 10) ?? "";
      const link = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      return `• [${date}${pts}${cmts}] ${title}\n  ${link}`;
    });
    return { providerId: this.id, label: "Hacker News (Algolia)", text: lines.join("\n") };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 3. Reddit (public JSON, sem auth)                           */
/* ────────────────────────────────────────────────────────── */
export const redditProvider: ResearchProvider = {
  id: "reddit",
  searchLike: true,
  label: "Reddit",
  description: "Posts e comentários públicos citando a marca.",
  enabled: () => true,
  async fetch(competitor) {
    const q = encodeURIComponent(competitor.name);
    const url = `https://www.reddit.com/search.json?q=${q}&limit=15&sort=relevance&t=year`;
    type Post = { data: { title: string; subreddit: string; score: number; num_comments: number; permalink: string; created_utc: number; selftext?: string } };
    const data = await fetchJson<{ data: { children: Post[] } }>(url);
    const children = data?.data?.children ?? [];
    if (!children.length) return null;
    const lines = children.slice(0, 12).map((p) => {
      const d = new Date(p.data.created_utc * 1000).toISOString().slice(0, 10);
      const snippet = (p.data.selftext || "").slice(0, 180).replace(/\s+/g, " ");
      return `• [r/${p.data.subreddit} · ${d} · ${p.data.score}↑ · ${p.data.num_comments}💬] ${p.data.title}${snippet ? `\n  ${snippet}` : ""}\n  https://reddit.com${p.data.permalink}`;
    });
    return { providerId: this.id, label: "Reddit", text: lines.join("\n") };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 4. Wayback Machine — CDX API                                */
/* ────────────────────────────────────────────────────────── */
export const waybackCdxProvider: ResearchProvider = {
  id: "wayback-cdx",
  label: "Wayback Machine (CDX)",
  description: "Histórico de snapshots do site — base para changelog retroativo.",
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}/*&output=json&collapse=digest&limit=60&filter=statuscode:200&from=20180101`;
    const rows = await fetchJson<string[][]>(url);
    if (!rows || rows.length < 2) return null;
    // first row is header
    const [, ...data] = rows;
    const byYear: Record<string, number> = {};
    const samples: string[] = [];
    for (const row of data) {
      const [, timestamp, original] = row;
      const year = timestamp.slice(0, 4);
      byYear[year] = (byYear[year] || 0) + 1;
      if (samples.length < 10) {
        const snap = `https://web.archive.org/web/${timestamp}/${original}`;
        samples.push(`• ${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)} · ${original}\n  ${snap}`);
      }
    }
    const dist = Object.entries(byYear)
      .sort()
      .map(([y, n]) => `${y}: ${n}`)
      .join(" · ");
    const text = `Snapshots por ano: ${dist}\n\nAmostra:\n${samples.join("\n")}`;
    return { providerId: this.id, label: "Wayback Machine — histórico", text };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 5. Sitemap + robots.txt                                     */
/* ────────────────────────────────────────────────────────── */
export const sitemapRobotsProvider: ResearchProvider = {
  id: "sitemap-robots",
  label: "Sitemap & robots.txt",
  description: "Estrutura do produto, rotas privadas e sitemaps declarados.",
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const base = `https://${host}`;
    const [robots, rootSitemap] = await Promise.all([
      fetchText(`${base}/robots.txt`),
      fetchText(`${base}/sitemap.xml`),
    ]);
    if (!robots && !rootSitemap) return null;
    const sitemapUrls = new Set<string>();
    const disallow: string[] = [];
    if (robots) {
      for (const line of robots.split(/\r?\n/)) {
        const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
        if (m) sitemapUrls.add(m[1]);
        const d = line.match(/^\s*Disallow:\s*(\S+)/i);
        if (d && d[1] !== "/") disallow.push(d[1]);
      }
    }
    if (rootSitemap) sitemapUrls.add(`${base}/sitemap.xml`);
    // fetch first sitemap and extract sample URLs
    const sample: string[] = [];
    for (const sm of [...sitemapUrls].slice(0, 2)) {
      const xml = await fetchText(sm);
      if (!xml) continue;
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, 20);
      sample.push(...locs);
    }
    const top = [...new Set(sample)].slice(0, 25);
    const text = [
      `Sitemaps declarados: ${[...sitemapUrls].slice(0, 5).join(", ") || "(nenhum)"}`,
      disallow.length ? `Rotas bloqueadas (disallow): ${disallow.slice(0, 15).join(", ")}` : "",
      top.length ? `Amostra de URLs do sitemap:\n${top.map((u) => `• ${u}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    return { providerId: this.id, label: "Sitemap & robots.txt", text };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 6. Portal da Transparência (contratos federais)             */
/* ────────────────────────────────────────────────────────── */
export const portalTransparenciaProvider: ResearchProvider = {
  id: "portal-transparencia",
  label: "Portal da Transparência",
  description: "Contratos da empresa com o Governo Federal (pesquisa por CNPJ).",
  enabled: (c) => !!c.cnpj,
  async fetch(competitor) {
    if (!competitor.cnpj) return null;
    const cnpj = competitor.cnpj.replace(/\D/g, "");
    // API pública exige token. Sem token, cai no HTML de busca.
    const token = process.env.PORTAL_TRANSPARENCIA_TOKEN;
    if (token) {
      const url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?cpfCnpjFornecedor=${cnpj}&pagina=1`;
      const data = await fetchJson<Array<{ numero?: string; objeto?: string; valorInicialCompra?: number; dataAssinatura?: string; orgao?: { nome?: string } }>>(url, {
        headers: { "chave-api-dados": token },
      });
      if (!data?.length) return null;
      const lines = data.slice(0, 10).map((c) => `• ${c.dataAssinatura ?? "?"} · ${c.orgao?.nome ?? "?"} · R$ ${c.valorInicialCompra ?? "?"}\n  ${c.objeto?.slice(0, 180) ?? ""}`);
      return { providerId: this.id, label: "Portal da Transparência — contratos", text: lines.join("\n") };
    }
    // sem token: indica URL de consulta manual
    const manual = `https://portaldatransparencia.gov.br/busca?termo=${cnpj}`;
    return {
      providerId: this.id,
      label: "Portal da Transparência",
      text: `Token não configurado (PORTAL_TRANSPARENCIA_TOKEN).\nConsulta manual: ${manual}`,
    };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 7. YouTube Data API (vídeos sobre a marca)                  */
/* ────────────────────────────────────────────────────────── */
export const youtubeDataProvider: ResearchProvider = {
  id: "youtube-data",
  searchLike: true,
  label: "YouTube Data",
  description: "Vídeos recentes citando a marca (reviews, tutoriais, lançamentos).",
  enabled: () => !!process.env.YOUTUBE_API_KEY,
  async fetch(competitor) {
    const key = process.env.YOUTUBE_API_KEY!;
    const q = encodeURIComponent(`${competitor.name} review OR análise OR lançamento`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&order=date&q=${q}&key=${key}`;
    const data = await fetchJson<{ items: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string; description: string } }> }>(url);
    if (!data?.items?.length) return null;
    const lines = data.items.map((it) => {
      const date = it.snippet.publishedAt.slice(0, 10);
      return `• [${date} · ${it.snippet.channelTitle}] ${it.snippet.title}\n  ${it.snippet.description.slice(0, 160)}\n  https://youtu.be/${it.id.videoId}`;
    });
    return { providerId: this.id, label: "YouTube Data", text: lines.join("\n") };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 8. PageSpeed Insights (proxy para HTTPArchive/CrUX)         */
/* ────────────────────────────────────────────────────────── */
export const pageSpeedProvider: ResearchProvider = {
  id: "pagespeed-crux",
  label: "PageSpeed / CrUX",
  description: "Core Web Vitals e performance real do site (origem CrUX).",
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const origin = `https://${host}`;
    const key = process.env.PAGESPEED_API_KEY;
    const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(origin)}&strategy=mobile&category=performance${key ? `&key=${key}` : ""}`;
    type Psi = {
      loadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }> };
      lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { displayValue?: string }> };
    };
    const data = await fetchJson<Psi>(url);
    if (!data) return null;
    const m = data.loadingExperience?.metrics ?? {};
    const perf = data.lighthouseResult?.categories?.performance?.score;
    const audits = data.lighthouseResult?.audits ?? {};
    const text = [
      `Performance score (mobile): ${perf != null ? Math.round(perf * 100) : "?"}/100`,
      `LCP: ${audits["largest-contentful-paint"]?.displayValue ?? "?"}`,
      `CLS: ${audits["cumulative-layout-shift"]?.displayValue ?? "?"}`,
      `TBT: ${audits["total-blocking-time"]?.displayValue ?? "?"}`,
      m.LARGEST_CONTENTFUL_PAINT_MS ? `LCP CrUX: ${m.LARGEST_CONTENTFUL_PAINT_MS.percentile}ms (${m.LARGEST_CONTENTFUL_PAINT_MS.category})` : "",
      m.INTERACTION_TO_NEXT_PAINT ? `INP CrUX: ${m.INTERACTION_TO_NEXT_PAINT.percentile}ms (${m.INTERACTION_TO_NEXT_PAINT.category})` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { providerId: this.id, label: "PageSpeed / CrUX", text };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 9. Site paths crawl — /produtos /taxas /pix etc.            */
/* ────────────────────────────────────────────────────────── */
const PRODUCT_PATHS = [
  "/produtos",
  "/maquininhas",
  "/pix",
  "/taxas",
  "/tarifas",
  "/precos",
  "/planos",
  "/solucoes",
  "/para-seu-negocio",
  "/credito",
  "/conta",
];

export const productPathsProvider: ResearchProvider = {
  id: "site-paths",
  label: "Crawl de rotas de produto",
  description: "Varre /produtos, /taxas, /pix, /planos — captura H1, meta e links.",
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const base = `https://${host}`;
    const results = await Promise.allSettled(
      PRODUCT_PATHS.map(async (path) => {
        const html = await fetchText(`${base}${path}`);
        if (!html) return null;
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
        const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i)?.[1];
        return { path, title, h1, desc };
      }),
    );
    type PathHit = { path: string; title?: string; h1?: string; desc?: string };
    const found: PathHit[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) found.push(r.value);
    }
    if (found.length === 0) return null;
    const lines = found.map((f) => `• ${f.path}\n  ${f.h1 || f.title || ""}\n  ${f.desc?.slice(0, 180) || ""}\n  ${base}${f.path}`.trim());
    return { providerId: this.id, label: "Rotas de produto (crawl)", text: lines.join("\n\n") };
  },
};

/* ────────────────────────────────────────────────────────── */
/* 10. minhareceita.org — Receita Federal (complementa QSA)   */
/* ────────────────────────────────────────────────────────── */
export const minhaReceitaProvider: ResearchProvider = {
  id: "minha-receita",
  label: "minhareceita.org",
  description: "Cadastro nacional da Receita Federal — QSA, CNAEs, regime tributário.",
  enabled: (c) => !!c.cnpj,
  async fetch(competitor: ResearchCompetitor) {
    if (!competitor.cnpj) return null;
    const cnpj = competitor.cnpj.replace(/\D/g, "");
    const url = `https://minhareceita.org/${cnpj}`;
    type R = {
      razao_social?: string;
      nome_fantasia?: string;
      capital_social?: number;
      porte?: string;
      natureza_juridica?: string;
      opcao_pelo_simples?: boolean;
      cnae_fiscal_descricao?: string;
      data_inicio_atividade?: string;
      qsa?: Array<{ nome_socio: string; qualificacao_socio: string }>;
    };
    const data = await fetchJson<R>(url);
    if (!data) return null;
    const qsa = (data.qsa || []).slice(0, 8).map((s) => `• ${s.nome_socio} — ${s.qualificacao_socio}`);
    const text = [
      data.razao_social && `Razão social: ${data.razao_social}`,
      data.nome_fantasia && `Fantasia: ${data.nome_fantasia}`,
      data.porte && `Porte: ${data.porte}`,
      data.capital_social != null && `Capital social: R$ ${data.capital_social.toLocaleString("pt-BR")}`,
      data.natureza_juridica && `Natureza: ${data.natureza_juridica}`,
      data.cnae_fiscal_descricao && `CNAE principal: ${data.cnae_fiscal_descricao}`,
      data.data_inicio_atividade && `Início: ${data.data_inicio_atividade}`,
      data.opcao_pelo_simples != null && `Simples: ${data.opcao_pelo_simples ? "sim" : "não"}`,
      qsa.length ? `QSA:\n${qsa.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      providerId: this.id,
      label: "Receita Federal (minhareceita.org)",
      text,
      hints: { cnpj, ...(data.razao_social ? { razao_social: data.razao_social } : {}) },
    };
  },
};
