import { getAnthropicClient } from "@/lib/anthropic/client";
import { scrapeWithJina } from "@/lib/sources/scraper";
import type { RawArticle } from "@/types";

/**
 * Two-stage deep fetch for newsletter/blog sources:
 * Stage 1: Get edition index from archive page (Jina + AI)
 * Stage 2: Fetch each today's/recent edition and extract individual stories
 */

interface EditionLink {
  title: string;
  url: string;
  published_at: string | null;
}

interface StoryItem {
  title: string;
  summary: string;
  url: string | null;
}

// Max concurrent edition fetches
const MAX_PARALLEL = 3;
// How many days back to include
const LOOKBACK_DAYS = 1;

// --- Stage 1: Get recent edition URLs from archive/homepage ---

async function getRecentEditions(archiveUrl: string): Promise<EditionLink[]> {
  const content = await scrapeWithJina(archiveUrl);
  if (!content || content.length < 100) return [];

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Extract the list of newsletter edition links from this archive page content.

For each edition return:
- "title": the edition title or date
- "url": the full URL (must start with https)
- "published_at": the date in ISO format (YYYY-MM-DD) if visible, otherwise null

Return ONLY a valid JSON array. Max 20 editions.

Content:
${content.slice(0, 5000)}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const editions = JSON.parse(match[0]) as EditionLink[];
    return editions.filter((e) => e.url?.startsWith("http"));
  } catch {
    return [];
  }
}

// --- Stage 2: Extract stories from a single edition ---

async function extractStoriesFromEdition(
  editionUrl: string,
  editionTitle: string,
  sourceName: string
): Promise<RawArticle[]> {
  const content = await scrapeWithJina(editionUrl);
  if (!content || content.length < 200) return [];

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `This is the full content of a newsletter edition called "${editionTitle}" from "${sourceName}".

Extract each individual news story covered in this edition. For each story:
- "title": the story headline (keep original language)
- "summary": 2-3 sentence description of what happened (keep original language)
- "url": the source article URL if mentioned (absolute URL starting with https), otherwise null

Rules:
- Only extract actual news stories, not ads, subscribe prompts, or navigation items
- Maximum 12 stories
- Return ONLY a valid JSON array, no markdown, no explanation

Content:
${content.slice(0, 10000)}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const stories = JSON.parse(match[0]) as StoryItem[];

    return stories
      .filter((s) => s.title && s.title.length > 5)
      .slice(0, 12)
      .map((s) => ({
        title: s.title,
        url: s.url ?? editionUrl,
        content: s.summary ?? "",
        source_name: sourceName,
        published_at: undefined,
      }));
  } catch {
    return [];
  }
}

// --- Filter editions to only recent ones ---

function isRecent(edition: EditionLink): boolean {
  if (!edition.published_at) return true; // include if no date (can't filter)
  try {
    const date = new Date(edition.published_at);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
    return date >= cutoff;
  } catch {
    return true;
  }
}

function isNavigationUrl(url: string): boolean {
  const noise = ["/subscribe", "/about", "/advertise", "/privacy", "/terms"];
  return noise.some((path) => url.endsWith(path) || url.includes(path + "?"));
}

// --- Main entry point ---

export async function deepFetchSource(
  domain: string,
  sourceName: string
): Promise<RawArticle[]> {
  // Try /archive first, fall back to homepage
  const archiveUrls = [
    `https://${domain}/archive`,
    `https://${domain}/`,
  ];

  let editions: EditionLink[] = [];
  for (const archiveUrl of archiveUrls) {
    editions = await getRecentEditions(archiveUrl);
    if (editions.length > 0) break;
  }

  if (editions.length === 0) return [];

  // Filter to recent editions only, skip navigation URLs
  const recentEditions = editions
    .filter((e) => !isNavigationUrl(e.url) && isRecent(e))
    .slice(0, MAX_PARALLEL * 2); // cap how many we deep-fetch

  if (recentEditions.length === 0) return [];

  // Parallel fetch in batches of MAX_PARALLEL
  const allArticles: RawArticle[] = [];
  for (let i = 0; i < recentEditions.length; i += MAX_PARALLEL) {
    const batch = recentEditions.slice(i, i + MAX_PARALLEL);
    const results = await Promise.allSettled(
      batch.map((e) => extractStoriesFromEdition(e.url, e.title, sourceName))
    );
    for (const r of results) {
      if (r.status === "fulfilled") allArticles.push(...r.value);
    }
  }

  return allArticles;
}
