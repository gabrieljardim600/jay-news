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

/** Apply relevance rules to items. Returns the kept items. */
export function filterItems(items: ParsedItem[], opts: RelevanceOptions): ParsedItem[] {
  const req = opts.requireTerms.map(norm).filter((t) => t.length >= 2);
  const bad = opts.excludeTerms.map(norm).filter((t) => t.length >= 2);
  const allow = (opts.domainAllow || []).map((d) => d.toLowerCase());

  return items.filter((it) => {
    const blob = norm([it.title, it.snippet, it.url, it.source].filter(Boolean).join(" "));
    if (bad.some((t) => blob.includes(t))) return false;
    if (!opts.strict) return true;
    if (allow.length && it.url) {
      try {
        const host = new URL(it.url).hostname.toLowerCase();
        if (allow.some((d) => host.includes(d))) return true;
      } catch {}
    }
    if (req.length === 0) return true;
    return req.some((t) => blob.includes(t));
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
