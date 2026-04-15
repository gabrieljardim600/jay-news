/**
 * Lightweight scrape of a company homepage to extract useful meta data:
 *  - title, description, og:image (logo)
 *  - theme-color / brand-color hints from meta tags and inline CSS
 *  - first <h1> / page headline
 * Avoids heavy DOM libs — pure regex over the HTML head + body slice.
 */

export type WebsiteMeta = {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  themeColor: string | null;
  detectedColors: string[];
  headline: string | null;
  bodySnippet: string | null;
};

function absoluteUrl(base: string, path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

function extractMeta(html: string, name: string, attr: "name" | "property" = "name"): string | null {
  const re = new RegExp(`<meta\\s+[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${name}["']`, "i");
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractFirstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

/** Collects unique hex colors mentioned in the HTML head/top — captures CSS vars and inline styles. */
function extractHexColors(html: string): string[] {
  // Look only at the first ~80KB (head + early body) to avoid matching random hex in scripts
  const slice = html.slice(0, 80_000);
  const seen = new Map<string, number>();
  // 6-digit hex colors only to avoid false positives
  const re = /#([0-9a-f]{6})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const hex = `#${m[1].toLowerCase()}`;
    // Skip near-black and near-white to surface the brand palette
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    const brightness = (r + g + b) / 3;
    if (brightness < 15 || brightness > 240) continue;
    seen.set(hex, (seen.get(hex) || 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => hex);
}

export async function fetchWebsiteMeta(rawUrl: string): Promise<WebsiteMeta | null> {
  if (!rawUrl) return null;
  let url: string;
  try {
    url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    new URL(url);
  } catch {
    return null;
  }

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title = extractTitle(html);
    const description = extractMeta(html, "description") || extractMeta(html, "og:description", "property");
    const ogImage = absoluteUrl(url, extractMeta(html, "og:image", "property") || extractMeta(html, "twitter:image"));
    const themeColor = extractMeta(html, "theme-color");
    const detectedColors = extractHexColors(html);
    const headline = extractFirstH1(html);
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      url,
      title,
      description,
      ogImage,
      themeColor,
      detectedColors,
      headline,
      bodySnippet: bodyText.slice(0, 1200) || null,
    };
  } catch {
    return null;
  }
}
