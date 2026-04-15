import type { ParsedItem, ResearchBlock } from "./types";

/** Split a block.text into bullet items (`• ` / `* ` / `- ` prefixed).
 *  Each item may have a continuation indented under it. Non-bullet
 *  preamble (section headings like `--- Busca: ... ---`) is kept as
 *  a pseudo-item with no url. */
export function parseBullets(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/);
  const items: ParsedItem[] = [];
  let current: { head: string; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const combined = current.body.join(" ").trim();
    const urlMatch = combined.match(/https?:\/\/\S+/);
    const url = urlMatch?.[0];
    const bodyNoUrl = combined.replace(/https?:\/\/\S+/g, "").trim();

    let head = current.head.trim();
    let source: string | undefined;
    let date: string | undefined;
    const metaMatch = head.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (metaMatch) {
      const metaParts = metaMatch[1].split("·").map((s) => s.trim()).filter(Boolean);
      for (const p of metaParts) {
        if (/^\d{4}-\d{2}-\d{2}/.test(p) || /^\d{8}$/.test(p)) date = p;
        else if (!source) source = p;
      }
      head = metaMatch[2] || metaMatch[1];
    }
    items.push({
      title: head || (bodyNoUrl.slice(0, 120) || url || "Resultado"),
      url,
      snippet: bodyNoUrl || undefined,
      source,
      date,
    });
    current = null;
  };

  for (const raw of lines) {
    const bulletMatch = raw.match(/^\s*[•*\-]\s+(.*)$/);
    if (bulletMatch) {
      flush();
      current = { head: bulletMatch[1], body: [] };
    } else if (current && raw.trim()) {
      current.body.push(raw.trim());
    }
  }
  flush();
  return items;
}

/** Parse "Key: Value" blocks into a flat meta map. Keeps order by using
 *  Object.assign on a plain object. */
export function parseMeta(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-zÀ-ÿ0-9 ./()_-]{2,40}):\s+(.+)$/);
    if (m && !/^\s*[•*\-]/.test(line)) {
      const key = m[1].trim();
      if (!out[key]) out[key] = m[2].trim();
    }
  }
  return out;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export type RelevanceOptions = {
  requireTerms: string[];    // keep items containing any of these (if strict)
  excludeTerms: string[];    // always drop items containing any of these
  domainAllow?: string[];    // host substrings; when set, urls must match
  strict: boolean;           // when false, only excludeTerms applied
};

/** Build a case-insensitive word-boundary regex for a term. Multi-word terms
 *  match as a phrase with flexible whitespace. Handles diacritics by normalizing. */
function termRegex(term: string): RegExp {
  const normalized = norm(term);
  // Escape regex specials
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
}

/** Apply relevance rules to items. Returns the kept items.
 *  Matching rules (strict mode):
 *  - Drop if any excludeTerm matches (substring, normalized).
 *  - Keep if the URL host matches one of domainAllow.
 *  - Otherwise require at least one requireTerm to appear as a *word* — this
 *    prevents matches like "Emma Stone" for an entity named "Stone". */
export function filterItems(items: ParsedItem[], opts: RelevanceOptions): ParsedItem[] {
  const bad = opts.excludeTerms.map(norm).filter((t) => t.length >= 2);
  const reqTerms = opts.requireTerms.map((t) => t.trim()).filter((t) => t.length >= 2);
  const reqRegex = reqTerms.map(termRegex);
  const allow = (opts.domainAllow || []).map((d) => d.toLowerCase());

  // Tight mode kicks in when the primary term is short enough to collide
  // with common English words (Stone, Bee, Apple, Dock). In that case we
  // require ≥2 distinct requireTerm matches for off-domain items — this
  // forces an alias, ticker, or URL fragment to co-occur with the name.
  const shortestTerm = reqTerms.reduce((min, t) => Math.min(min, t.replace(/\W/g, "").length), Infinity);
  const tight = reqTerms.length >= 2 && shortestTerm <= 6;

  return items.filter((it) => {
    const blob = norm([it.title, it.snippet, it.url, it.source].filter(Boolean).join(" "));
    if (bad.some((t) => blob.includes(t))) return false;
    if (!opts.strict) return true;

    let onAllowedDomain = false;
    if (allow.length && it.url) {
      try {
        const host = new URL(it.url).hostname.toLowerCase();
        if (allow.some((d) => host.includes(d))) onAllowedDomain = true;
      } catch {}
    }
    if (onAllowedDomain) return true;

    if (reqRegex.length === 0) return true;
    const matchCount = reqRegex.reduce((n, re) => n + (re.test(blob) ? 1 : 0), 0);
    return tight ? matchCount >= 2 : matchCount >= 1;
  });
}

/** Rebuild a text representation from filtered items, keeping the same
 *  bullet format downstream consumers expect. */
export function renderItems(items: ParsedItem[]): string {
  return items.map((it) => {
    const head = it.source || it.date
      ? `• [${[it.source, it.date].filter(Boolean).join(" · ")}] ${it.title}`
      : `• ${it.title}`;
    const parts = [head];
    if (it.snippet) parts.push(`  ${it.snippet}`);
    if (it.url) parts.push(`  ${it.url}`);
    return parts.join("\n");
  }).join("\n");
}

/** Enrich a block with parsed items/meta and apply relevance filter when
 *  the source provider is search-like. Returns the (possibly modified)
 *  block, or null when nothing remains after filtering. */
export function enrichAndFilter(
  block: ResearchBlock,
  searchLike: boolean,
  opts: RelevanceOptions,
): ResearchBlock | null {
  if (!searchLike) {
    const meta = parseMeta(block.text);
    if (Object.keys(meta).length > 0) block.meta = meta;
    return block;
  }
  const items = parseBullets(block.text);
  if (items.length === 0) return block;
  const kept = filterItems(items, opts);
  if (kept.length === 0) return null;
  return { ...block, items: kept, text: renderItems(kept) };
}
