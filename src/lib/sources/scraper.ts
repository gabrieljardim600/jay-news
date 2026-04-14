import type { RawArticle } from "@/types";

/**
 * Fallback chain for extracting articles from web sources:
 * 1. Jina Reader (converts any URL to clean markdown)
 * 2. Direct fetch + HTML extraction
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
  // Strip script, style, nav, header, footer tags and their content
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text.length > 200 ? text : null;
}

// --- Extract article-like blocks from markdown ---

interface ExtractedArticle {
  title: string;
  url: string;
  snippet: string;
}

export function extractArticlesFromMarkdown(markdown: string, sourceDomain: string): ExtractedArticle[] {
  const articles: ExtractedArticle[] = [];
  const seen = new Set<string>();

  // Pattern 1: Markdown headings followed by content
  // ## Title or ### Title, possibly with a link
  const headingPattern = /^#{1,3}\s+\[?([^\]\n]+)\]?\(?([^)\s]*)\)?/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2]?.trim() || "";
    if (title.length > 10 && !seen.has(title)) {
      seen.add(title);
      // Grab next 200 chars as snippet
      const afterMatch = markdown.slice(match.index + match[0].length, match.index + match[0].length + 300).trim();
      const snippet = afterMatch.replace(/^[\s\n#-]+/, "").slice(0, 200);
      articles.push({ title, url, snippet });
    }
  }

  // Pattern 2: Markdown links with descriptive text [Title](url)
  const linkPattern = /\[([^\]]{15,})\]\((https?:\/\/[^)]+)\)/g;
  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    if (!seen.has(title) && !title.startsWith("http")) {
      seen.add(title);
      const afterMatch = markdown.slice(match.index + match[0].length, match.index + match[0].length + 300).trim();
      const snippet = afterMatch.replace(/^[\s\n#-]+/, "").slice(0, 200);
      articles.push({ title, url, snippet });
    }
  }

  return articles.slice(0, 15);
}

// --- Main fallback scraper ---

export async function scrapeWebSource(
  domain: string,
  sourceName: string
): Promise<RawArticle[]> {
  const url = `https://${domain}`;

  // Try Jina Reader first
  const jinaContent = await scrapeWithJina(url);
  if (jinaContent) {
    const extracted = extractArticlesFromMarkdown(jinaContent, domain);
    if (extracted.length > 0) {
      return extracted.map((a) => ({
        title: a.title,
        url: a.url.startsWith("http") ? a.url : `${url}${a.url.startsWith("/") ? "" : "/"}${a.url}`,
        content: a.snippet,
        source_name: sourceName || domain,
      }));
    }

    // If no structured articles found, return the whole page as one "article"
    // The AI processor will handle summarization
    return [{
      title: `${sourceName || domain} — conteudo de hoje`,
      url,
      content: jinaContent.slice(0, 3000),
      source_name: sourceName || domain,
    }];
  }

  // Fallback: direct fetch
  const htmlContent = await scrapeWithFetch(url);
  if (htmlContent) {
    return [{
      title: `${sourceName || domain} — conteudo de hoje`,
      url,
      content: htmlContent.slice(0, 3000),
      source_name: sourceName || domain,
    }];
  }

  return [];
}
