import type { RawArticle } from "@/types";

export type CompetitorRef = {
  id: string;
  name: string;
  website: string | null;
  aliases: string[];
};

function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Short single-word generic company names (e.g., "Stone", "Rede") collide with
// English/Portuguese common words. Only match via domain in those cases.
function isAmbiguousSingleWord(token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.includes(" ")) return false;
  if (trimmed.length > 8) return false;
  // If it contains accent marks / uppercase-only / digits, treat as distinct
  if (/[\u00C0-\u024F]/.test(trimmed)) return false;
  return true;
}

function buildTokens(c: CompetitorRef): { tokens: string[]; host: string | null } {
  const host = normalizeHost(c.website);
  const rawTokens = [c.name, ...(c.aliases || [])]
    .map((s) => (s || "").trim())
    .filter((s) => s.length >= 3);
  // If primary name is ambiguous (single short word) and aliases give no
  // disambiguation, only keep non-ambiguous tokens (aliases with spaces/accents)
  const tokens = rawTokens.filter((t) => !isAmbiguousSingleWord(t));
  return { tokens, host };
}

function containsWholeWord(haystack: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return pattern.test(haystack);
}

/** Returns the competitor ids mentioned in the given article. */
export function findMentions(article: RawArticle, competitors: CompetitorRef[]): string[] {
  if (competitors.length === 0) return [];
  const text = `${article.title}\n${article.content || ""}`;
  const articleHost = normalizeHost(article.url);
  const matched = new Set<string>();
  for (const c of competitors) {
    const { tokens, host } = buildTokens(c);
    if (host && articleHost && (articleHost === host || articleHost.endsWith(`.${host}`))) {
      matched.add(c.id);
      continue;
    }
    for (const t of tokens) {
      if (containsWholeWord(text, t)) {
        matched.add(c.id);
        break;
      }
    }
  }
  return [...matched];
}
