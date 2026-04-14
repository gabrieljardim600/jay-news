import type { RawArticle, Exclusion } from "@/types";

/**
 * Keep only articles where the topic or any keyword appears in title or content.
 * Used for trends mode to drop off-topic results Tavily returns on generic queries.
 * Proper nouns (capitalized multi-word) are matched case-insensitively and whole-word.
 */
export function filterByTopicRelevance(
  articles: RawArticle[],
  topic: string,
  keywords: string[]
): RawArticle[] {
  // Terms to match: the topic itself + each keyword + significant words from the topic
  const terms = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length >= 3) terms.add(t);
  };
  add(topic);
  for (const k of keywords) add(k);
  // Also match significant individual words from the topic — drops connectives only
  const CONNECTIVES = new Set([
    "sobre", "como", "para", "com", "pela", "pelo", "que", "dos", "das", "do", "da", "de", "e", "em", "no", "na",
    "about", "with", "from", "the", "and", "of", "in", "on", "to", "for",
  ]);
  for (const word of topic.split(/\s+/)) {
    const clean = word.toLowerCase().replace(/[^\wà-ú]/gi, "");
    if (clean.length >= 3 && !CONNECTIVES.has(clean)) {
      terms.add(clean);
    }
  }

  if (terms.size === 0) return articles;

  return articles.filter((a) => {
    const haystack = `${a.title} ${a.content || ""}`.toLowerCase();
    for (const term of terms) {
      if (haystack.includes(term)) return true;
    }
    return false;
  });
}

const STOPWORDS = new Set([
  // PT
  "de","do","da","dos","das","em","no","na","nos","nas","para","por","com",
  "que","se","ao","aos","às","uma","uns","umas","um","os","as","o","a","e",
  "mas","ou","seu","sua","seus","suas","este","esta","esse","essa","isso",
  // EN
  "the","of","in","a","an","and","to","for","on","at","is","was","are","were",
  "has","have","had","be","been","with","from","by","this","that","its","new",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function titlesAreSimilar(a: string, b: string, threshold = 0.62): boolean {
  const wa = titleTokens(a);
  const wb = titleTokens(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size) >= threshold;
}

export function filterArticles(articles: RawArticle[], exclusions: Exclusion[]): RawArticle[] {
  const excludeKeywords = exclusions.filter((e) => e.is_active).map((e) => e.keyword.toLowerCase());

  // 1. Keyword exclusions
  let filtered = articles.filter((article) => {
    const text = `${article.title} ${article.content}`.toLowerCase();
    return !excludeKeywords.some((kw) => text.includes(kw));
  });

  // 2. Exact URL dedup
  const seenUrls = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.url.toLowerCase().replace(/\/+$/, "");
    if (seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    return true;
  });

  // 3. Exact title dedup
  const seenTitles = new Set<string>();
  filtered = filtered.filter((a) => {
    const normalized = a.title.toLowerCase().trim();
    if (seenTitles.has(normalized)) return false;
    seenTitles.add(normalized);
    return true;
  });

  // 4. Near-duplicate title dedup (same story, different sources)
  // Keep the first occurrence; discard articles whose title is ≥62% token-similar to a kept article
  const keptTitles: string[] = [];
  filtered = filtered.filter((a) => {
    const isDup = keptTitles.some((kept) => titlesAreSimilar(a.title, kept));
    if (!isDup) keptTitles.push(a.title);
    return !isDup;
  });

  return filtered;
}
