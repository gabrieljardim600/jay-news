import { getAnthropicClient } from "@/lib/anthropic/client";
import type { RawArticle } from "@/types";

/**
 * Fallback chain for extracting articles from web sources:
 * 1. Jina Reader (converts any URL to clean markdown)
 * 2. Direct fetch + HTML extraction
 *
 * Content is then parsed by AI (Haiku) to extract structured articles.
 */

const JINA_TIMEOUT = 15000;
const FETCH_TIMEOUT = 10000;

// --- Jina Reader ---

export async function scrapeWithJina(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT);

    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "markdown",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const text = await response.text();
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

// --- Direct fetch + HTML extraction ---

export async function scrapeWithFetch(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: { "User-Agent": "JNews/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

function extractTextFromHtml(html: string): string | null {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  return text.length > 200 ? text : null;
}

// --- AI-powered article extraction ---

// Noise patterns to skip — ads, logos, icons, trackers, social share images
const IMAGE_NOISE = /\/(ad|ads|advert|banner|logo|icon|favicon|pixel|tracker|sponsor|promo|widget|social|share|avatar|profile|badge)\b|\.gif$|data:image|1x1|pixel\.png/i;

function extractImagesFromMarkdown(markdown: string): string[] {
  const matches = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)];
  return matches
    .map((m) => m[1])
    .filter((url) => !IMAGE_NOISE.test(url));
}

interface AIExtractedArticle {
  title: string;
  url: string;
  summary: string;
  image_url?: string | null;
}

async function extractArticlesWithAI(
  content: string,
  sourceDomain: string,
  sourceUrl: string
): Promise<AIExtractedArticle[]> {
  try {
    const client = getAnthropicClient();
    const truncated = content.slice(0, 6000);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `You are a news article extractor. Analyze the following webpage content from ${sourceDomain} and extract individual news articles or stories.

For each article found, return:
- "title": the headline (clean, no markdown)
- "url": the full article URL if available, otherwise "${sourceUrl}"
- "summary": 1-2 sentence summary of the article content
- "image_url": the main editorial image URL for this article if present (must start with https), otherwise null. Skip logos, icons, ads, banners, avatars, or social sharing images.

Rules:
- Extract only NEWS articles, not navigation items, ads, or site descriptions
- Maximum 10 articles
- If the content is a single article page (not a homepage/feed), extract that one article
- URLs must be absolute (start with http). If you find relative URLs, prepend "${sourceUrl}"
- Write summaries in the same language as the content

Return ONLY a valid JSON array, no markdown, no explanation. If no articles found, return [].

Content:
${truncated}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const articles = JSON.parse(jsonMatch[0]) as AIExtractedArticle[];
    return articles.filter((a) => a.title && a.title.length > 5).slice(0, 10);
  } catch (error) {
    console.error("AI extraction failed:", error);
    return [];
  }
}

// --- Main fallback scraper ---

export async function scrapeWebSource(
  domain: string,
  sourceName: string
): Promise<RawArticle[]> {
  const url = `https://${domain}`;
  const name = sourceName || domain;

  // Try Jina Reader first (best quality — returns clean markdown)
  const jinaContent = await scrapeWithJina(url);
  if (jinaContent) {
    const articles = await extractArticlesWithAI(jinaContent, domain, url);
    if (articles.length > 0) {
      // Parse markdown images as fallback pool when AI doesn't return one
      const markdownImages = extractImagesFromMarkdown(jinaContent);
      return articles.map((a, i) => ({
        title: a.title,
        url: a.url.startsWith("http") ? a.url : url,
        content: a.summary,
        source_name: name,
        image_url: a.image_url || markdownImages[i] || markdownImages[0] || undefined,
      }));
    }
  }

  // Fallback: direct fetch + AI extraction
  const htmlContent = await scrapeWithFetch(url);
  if (htmlContent) {
    const articles = await extractArticlesWithAI(htmlContent, domain, url);
    if (articles.length > 0) {
      return articles.map((a) => ({
        title: a.title,
        url: a.url.startsWith("http") ? a.url : url,
        content: a.summary,
        source_name: name,
        image_url: a.image_url || undefined,
      }));
    }
  }

  return [];
}
