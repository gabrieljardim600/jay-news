import type { RawArticle, Exclusion } from "@/types";

export function filterArticles(articles: RawArticle[], exclusions: Exclusion[]): RawArticle[] {
  const excludeKeywords = exclusions.filter((e) => e.is_active).map((e) => e.keyword.toLowerCase());

  let filtered = articles.filter((article) => {
    const text = `${article.title} ${article.content}`.toLowerCase();
    return !excludeKeywords.some((kw) => text.includes(kw));
  });

  const seenUrls = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.url.toLowerCase().replace(/\/+$/, "");
    if (seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    return true;
  });

  const seenTitles = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.title.toLowerCase().trim();
    if (seenTitles.has(normalized)) return false;
    seenTitles.add(normalized);
    return true;
  });

  return filtered;
}
