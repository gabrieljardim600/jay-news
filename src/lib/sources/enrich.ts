import type { RawArticle } from "@/types";

const JINA_TIMEOUT = 12000;
const MAX_PARALLEL = 5;
const MIN_CONTENT_LENGTH = 150;

/**
 * Enrich articles by fetching full content + images from each article URL.
 * Runs after initial article collection, before AI processing.
 */
export async function enrichArticles(articles: RawArticle[]): Promise<RawArticle[]> {
  const needsEnrichment = articles.filter(
    (a) => a.url && (!a.full_content || a.full_content.length < MIN_CONTENT_LENGTH || !a.image_url)
  );

  if (needsEnrichment.length === 0) return articles;

  // Process in batches to avoid overwhelming Jina
  for (let i = 0; i < needsEnrichment.length; i += MAX_PARALLEL) {
    const batch = needsEnrichment.slice(i, i + MAX_PARALLEL);
    const results = await Promise.allSettled(
      batch.map((article) => fetchArticlePage(article.url))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status !== "fulfilled" || !result.value) continue;

      const { content, imageUrl } = result.value;
      const article = batch[j];

      // Only replace full_content if we got something substantially better
      if (content && content.length > (article.full_content?.length || 0) && content.length >= MIN_CONTENT_LENGTH) {
        article.full_content = content;
      }

      // Add image if missing
      if (!article.image_url && imageUrl) {
        article.image_url = imageUrl;
      }
    }
  }

  return articles;
}

async function fetchArticlePage(url: string): Promise<{ content: string | null; imageUrl: string | null } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT);

    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "markdown",
        "X-With-Images": "true",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const markdown = await response.text();
    if (markdown.length < 100) return null;

    const content = extractArticleBody(markdown);
    const imageUrl = extractMainImage(markdown);

    return { content, imageUrl };
  } catch {
    return null;
  }
}

/**
 * Check if a line looks like a navigation menu (many short capitalized/titled phrases).
 * E.g.: "Tudo sobre Carros Elétricos e híbridos Segredos e flagras Carros clássicos"
 */
function looksLikeNavMenu(line: string): boolean {
  // If the line has a period followed by a space mid-sentence, it's likely prose
  if (/\.\s[A-Z]/.test(line) && (line.match(/\.\s/g) || []).length >= 2) return false;
  // Navigation: line has many title-cased words and few sentence markers
  const words = line.split(/\s+/);
  if (words.length < 4) return false;
  const titleCased = words.filter((w) => /^[A-ZÀ-Ú]/.test(w)).length;
  const hasNoPeriods = !/\.\s/.test(line) && !line.endsWith(".");
  // If >60% of words are title-cased and there are no periods, likely nav
  if (hasNoPeriods && titleCased / words.length > 0.6 && words.length > 6) return true;
  // Lines with lots of very short segments separated by double spaces (menu items)
  const segments = line.split(/\s{2,}/);
  if (segments.length >= 4 && segments.every((s) => s.length < 40)) return true;
  return false;
}

/**
 * Extract the article body from Jina markdown, stripping navigation/header/footer noise.
 */
function extractArticleBody(markdown: string): string | null {
  // Detect 404/error pages
  const headerCheck = markdown.slice(0, 1500).toLowerCase();
  if (headerCheck.includes("404") && (headerCheck.includes("not found") || headerCheck.includes("não encontrad") || headerCheck.includes("pagina nao"))) {
    return null;
  }

  // Remove Jina metadata header (Title:, URL Source:, etc.)
  let body = markdown.replace(/^(Title|URL Source|Markdown Content|Published Time|Description):.*\n/gm, "");

  // Remove image markdown syntax but keep text
  body = body.replace(/!\[[^\]]*\]\([^)]+\)/g, "");

  // Remove links — keep anchor text, drop empty links
  body = body.replace(/\[[^\]]*\]\([^)]+\)/g, (match) => {
    const text = match.match(/\[([^\]]*)\]/)?.[1] || "";
    return text;
  });

  // Full-line noise (exact match)
  const NOISE_LINES = /^(menu|login|cadastr|acesse sua conta|carregando|assine|inscreva|subscribe|newsletter|compartilh|share|tags?:|leia (mais|tambem)|veja (mais|tambem)|related|comentarios|publicidade|anuncie|copyright|todos os direitos|ultimas noticias|mais lidas|trending|popular|follow us|siga-nos|redes sociais|facebook|twitter|instagram|whatsapp|telegram|youtube|tiktok|pinterest|linkedin|politica de privacidade|termos de uso|fale conosco|sobre nos|contato|anuncie|expediente|colunistas)$/i;

  // Partial noise — lines CONTAINING these are navigation, not article text
  const NOISE_CONTAINS = /carregando|acesse sua conta|cadastre-se|menu\s+(principal|autoesporte|principal)|últimas\s+notícias|mais\s+lidas|redes\s+sociais|siga-nos|follow\s+us|subscribe|assine\s+(já|agora|aqui)|inscreva-se|politica\s+de\s+privacidade|termos\s+de\s+uso|todos\s+os\s+direitos|copyright\s+©/i;

  // Remove markdown headers and noise
  body = body.replace(/^#{1,6}\s+.*$/gm, (match) => {
    const text = match.replace(/^#+\s*/, "").trim();
    if (text.length > 50 && !NOISE_CONTAINS.test(text)) return text;
    if (NOISE_LINES.test(text)) return "";
    if (text.length < 30) return "";
    if (NOISE_CONTAINS.test(text)) return "";
    return text;
  });

  // Remove excessive whitespace
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  // Remove markdown bold/italic for cleaner reading
  body = body.replace(/\*\*([^*]+)\*\*/g, "$1");
  body = body.replace(/\*([^*]+)\*/g, "$1");

  // Filter lines
  const lines = body.split("\n");
  const contentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) { contentLines.push(""); continue; }
    // Skip exact noise lines
    if (NOISE_LINES.test(trimmed)) continue;
    // Skip lines containing navigation keywords
    if (NOISE_CONTAINS.test(trimmed)) continue;
    // Skip very short lines that look like UI elements
    if (trimmed.length < 15 && !trimmed.endsWith(".") && !trimmed.endsWith(":")) continue;
    // Skip lines that look like navigation menus (many short capitalized phrases)
    if (looksLikeNavMenu(trimmed)) continue;
    // Skip bare image URL lines
    if (/^(https?:\/\/|\/)[^\s]+\.(jpg|jpeg|png|webp|gif)/i.test(trimmed)) continue;
    // Skip photo captions (ending with "— Foto:" pattern)
    if (/— Foto:/i.test(trimmed) && trimmed.length < 200) continue;
    contentLines.push(trimmed);
  }

  // Find the start of actual content — look for real prose (multiple sentences)
  let startIdx = 0;
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].trim();
    if (line.length === 0) continue;
    // Count sentence-ending periods (period followed by space or end)
    const periods = (line.match(/\.\s|\.$/g) || []).length;
    // Real prose: substantial text with multiple sentences
    if (line.length > 100 && periods >= 2) { startIdx = i; break; }
    // Acceptable: >150 chars with at least one period
    if (line.length > 150 && periods >= 1) { startIdx = i; break; }
  }

  const result = contentLines.slice(startIdx).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Truncate very long articles to ~5000 chars
  if (result.length > 5000) {
    // Try to cut at a sentence boundary
    const cutPoint = result.lastIndexOf(". ", 5000);
    return result.slice(0, cutPoint > 4000 ? cutPoint + 1 : 5000) + "...";
  }

  return result.length >= MIN_CONTENT_LENGTH ? result : null;
}

/**
 * Extract the main editorial image from Jina markdown.
 * Prioritizes large, content-relevant images.
 */
function extractMainImage(markdown: string): string | null {
  // Noise patterns to skip
  const NOISE = /\/(ad|ads|advert|banner|logo|icon|favicon|pixel|tracker|sponsor|promo|widget|social|share|avatar|profile|badge|button|arrow|loading|spinner|play|play-button|close|menu|hamburger|search|check|star|heart|thumb|like|comment|reply|forward|back|prev|next|caret|chevron|expand|collapse|download|upload|print|email|mail|notification|bell|cart|bag|user|account|login|signup|subscribe)\b|\.gif$|\.svg$|data:image|1x1|pixel\.png|gravatar|emoji|smiley|blank\.|spacer|transparent|placeholder/i;
  const MIN_IMAGE_SIZE = 200;

  // Collect all images with their context
  const imageMatches = [...markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)];
  const candidates: { url: string; score: number }[] = [];

  for (const match of imageMatches) {
    const alt = match[1];
    const url = match[2];
    if (NOISE.test(url)) continue;

    let score = 0;

    // Prefer images with large dimensions in URL
    const sizeMatch = url.match(/[\/_-](\d+)x(\d+)/);
    if (sizeMatch) {
      const w = parseInt(sizeMatch[1]);
      const h = parseInt(sizeMatch[2]);
      if (w < MIN_IMAGE_SIZE || h < MIN_IMAGE_SIZE) continue;
      score += Math.min(w * h / 10000, 50); // bigger = better, capped
    }

    // Prefer images with meaningful alt text
    if (alt && alt.length > 10) score += 20;

    // Prefer jpg/jpeg/webp (usually photos vs UI)
    if (/\.(jpg|jpeg|webp)/i.test(url)) score += 10;

    // Prefer images with "image", "foto", "photo", "media" in path
    if (/(image|foto|photo|media|upload|content)/i.test(url)) score += 10;

    // Penalize very small filenames (likely icons)
    if (url.length < 60) score -= 10;

    // Penalize theme/asset paths
    if (/(theme|asset|static|general|layout|template)/i.test(url)) score -= 15;

    candidates.push({ url, score });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 0) return candidates[0].url;

  // Fallback: try bare image URLs
  const bareImages = [...markdown.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/gi)];
  for (const match of bareImages) {
    const url = match[1];
    if (!NOISE.test(url) && url.length > 60) return url;
  }

  return null;
}
