import { searchTavily } from "@/lib/sources/search";

const TLD_BLACKLIST = new Set([
  "wikipedia.org", "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
  "reclameaqui.com.br", "consumidor.gov.br", "glassdoor.com", "glassdoor.com.br", "crunchbase.com",
  "g1.globo.com", "valor.globo.com", "folha.uol.com.br", "estadao.com.br", "infomoney.com.br",
  "uol.com.br", "globo.com", "terra.com.br", "ig.com.br", "exame.com", "veja.abril.com.br",
  "cnpj.biz", "econodata.com.br", "cnpjbiz.com", "empresaqui.com.br", "cnpj.consultas.online",
  "github.com", "medium.com", "substack.com", "reddit.com", "tiktok.com", "pinterest.com",
]);

function hostOf(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function normalizeCnpj(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

async function discoverWebsite(name: string): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const r = await searchTavily(`"${name}" site oficial institucional`, 8, undefined, "basic", 365);
    for (const item of r) {
      const host = hostOf(item.url);
      if (!host) continue;
      if (TLD_BLACKLIST.has(host)) continue;
      // Prefer domains whose root contains a slug of the name
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      if (slug.length >= 3 && host.replace(/[.-]/g, "").includes(slug)) {
        return `https://${host}`;
      }
    }
    // fallback: first non-blacklisted hit
    for (const item of r) {
      const host = hostOf(item.url);
      if (host && !TLD_BLACKLIST.has(host)) return `https://${host}`;
    }
  } catch {}
  return null;
}

async function extractCnpjFromWebsite(website: string): Promise<string | null> {
  try {
    const base = new URL(website);
    const candidates = [base.toString(), `${base.origin}/sobre`, `${base.origin}/sobre-nos`, `${base.origin}/institucional`, `${base.origin}/contato`, `${base.origin}/quem-somos`];
    const results = await Promise.allSettled(candidates.map(async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000), headers: { "User-Agent": "JNews/1.0" }, redirect: "follow" });
      if (!res.ok) return null;
      const html = (await res.text()).slice(0, 300_000);
      const m = html.match(/\b(\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[/\s-]?\d{4}[-\s.]?\d{2})\b/);
      return m ? normalizeCnpj(m[1]) : null;
    }));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) return r.value;
    }
  } catch {}
  return null;
}

async function discoverCnpjViaSearch(name: string, website: string | null): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const query = website
      ? `"${name}" CNPJ ${new URL(website).hostname.replace(/^www\./, "")}`
      : `"${name}" CNPJ razão social`;
    const r = await searchTavily(query, 5, ["bcb.gov.br", "minhareceita.org", "cnpj.biz", "econodata.com.br", "receita.fazenda.gov.br"], "basic", 540);
    for (const item of r) {
      const blob = `${item.title} ${item.content}`;
      const m = blob.match(/\b(\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[/\s-]?\d{4}[-\s.]?\d{2})\b/);
      if (m) {
        const cnpj = normalizeCnpj(m[1]);
        if (cnpj) return cnpj;
      }
    }
  } catch {}
  return null;
}

export type DiscoveryInput = {
  name: string;
  website?: string | null;
  cnpj?: string | null;
};

export type DiscoveryResult = {
  website: string | null;
  cnpj: string | null;
  /** Which fields the platform found on its own (i.e. the user left blank). */
  discovered: Array<"website" | "cnpj">;
};

/** Fills in website and/or CNPJ when the user omitted them, using Tavily +
 *  direct scraping. Never overrides a value the user provided. */
export async function autoDiscoverEntity(input: DiscoveryInput): Promise<DiscoveryResult> {
  const discovered: Array<"website" | "cnpj"> = [];
  let website = input.website?.trim() || null;
  let cnpj = input.cnpj ? normalizeCnpj(input.cnpj) : null;

  if (!website) {
    const found = await discoverWebsite(input.name);
    if (found) {
      website = found;
      discovered.push("website");
    }
  }

  if (!cnpj) {
    if (website) {
      const fromSite = await extractCnpjFromWebsite(website);
      if (fromSite) {
        cnpj = fromSite;
        discovered.push("cnpj");
      }
    }
    if (!cnpj) {
      const fromSearch = await discoverCnpjViaSearch(input.name, website);
      if (fromSearch) {
        cnpj = fromSearch;
        if (!discovered.includes("cnpj")) discovered.push("cnpj");
      }
    }
  }

  return { website, cnpj, discovered };
}
