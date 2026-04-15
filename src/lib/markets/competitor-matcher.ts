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

function buildTokens(c: CompetitorRef): { tokens: string[]; host: string | null } {
  const tokens = [c.name, ...(c.aliases || [])]
    .map((s) => (s || "").trim())
    .filter((s) => s.length >= 3);
  return { tokens, host: normalizeHost(c.website) };
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
