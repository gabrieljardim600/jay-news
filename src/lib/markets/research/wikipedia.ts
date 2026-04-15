/**
 * Fetches a summary from pt.wikipedia.org for a given entity name.
 * Uses the public REST API — no auth needed. Returns null if not found.
 */

export type WikipediaSummary = {
  title: string;
  description: string | null;
  extract: string;
  url: string;
  thumbnail?: string | null;
  originalImage?: string | null;
};

async function searchPage(name: string): Promise<string | null> {
  const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "JNews/1.0 (gabriel@jnews.app)" } });
    if (!res.ok) return null;
    const data = await res.json();
    const title: string | undefined = data?.query?.search?.[0]?.title;
    return title ?? null;
  } catch {
    return null;
  }
}

export async function fetchWikipediaSummary(name: string): Promise<WikipediaSummary | null> {
  const title = await searchPage(name);
  if (!title) return null;
  const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s/g, "_"))}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "JNews/1.0 (gabriel@jnews.app)" } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? title,
      description: data.description ?? null,
      extract: data.extract ?? "",
      url: data.content_urls?.desktop?.page ?? `https://pt.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      thumbnail: data.thumbnail?.source ?? null,
      originalImage: data.originalimage?.source ?? null,
    };
  } catch {
    return null;
  }
}

/** Fetches the first paragraphs (plain text) from the article — richer than summary. */
export async function fetchWikipediaExtract(name: string, chars = 4000): Promise<string | null> {
  const title = await searchPage(name);
  if (!title) return null;
  const url = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=&explaintext=&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "JNews/1.0 (gabriel@jnews.app)" } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as { extract?: string } | undefined;
    const text = page?.extract;
    if (!text) return null;
    return text.slice(0, chars);
  } catch {
    return null;
  }
}
