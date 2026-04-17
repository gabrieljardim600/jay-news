import type { RawAsset, PageMeta, AssetType } from "./types";

/**
 * Extrai URLs de assets de uma página HTML — logos, ícones, imagens, favicons, og-images.
 * Trabalha em HTML estático (fetch direto). Sem browser.
 */

export function classify(url: string): AssetType {
  const lower = url.toLowerCase();
  if (/\b(logo|brand)\b/.test(lower)) return "logo";
  if (/\b(icon|favicon|sprite)\b/.test(lower) || lower.endsWith(".ico")) return "icon";
  return "image";
}

export function extractPageMeta(html: string, pageUrl: string): PageMeta {
  const title = match(html, /<title[^>]*>([^<]+)<\/title>/i);
  const description = metaContent(html, "description") || metaContent(html, "og:description");
  const ogImage = absolutize(metaContent(html, "og:image"), pageUrl);

  let faviconUrl: string | undefined;
  const iconMatch = html.match(
    /<link[^>]*\brel=["'](?:[^"']*\b(?:icon|shortcut icon)\b[^"']*)["'][^>]*>/i
  );
  if (iconMatch) {
    const href = iconMatch[0].match(/\bhref=["']([^"']+)["']/i);
    if (href) faviconUrl = absolutize(href[1], pageUrl) ?? undefined;
  }
  if (!faviconUrl) {
    try {
      faviconUrl = new URL("/favicon.ico", pageUrl).href;
    } catch {}
  }

  return {
    url: pageUrl,
    title: title?.trim(),
    description: description?.trim(),
    faviconUrl,
    ogImage: ogImage ?? undefined,
  };
}

export function extractAssets(html: string, pageUrl: string): RawAsset[] {
  const assets: RawAsset[] = [];
  const seen = new Set<string>();

  // <img src> + lazy-load attrs + srcset
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const [tag] of imgTags) {
    const candidates: string[] = [];
    for (const attr of ["src", "data-src", "data-lazy", "data-original"]) {
      const m = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, "i"));
      if (m) candidates.push(m[1]);
    }
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (srcset) {
      srcset[1]
        .split(",")
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean)
        .forEach((u) => candidates.push(u));
    }
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1];
    const width = parseIntOrUndef(tag.match(/\bwidth=["']?(\d+)/i)?.[1]);
    const height = parseIntOrUndef(tag.match(/\bheight=["']?(\d+)/i)?.[1]);
    for (const raw of candidates) {
      const abs = absolutize(raw, pageUrl);
      if (!abs || seen.has(abs)) continue;
      seen.add(abs);
      assets.push({
        type: classify(abs),
        originalUrl: abs,
        sourcePageUrl: pageUrl,
        alt,
        width,
        height,
      });
    }
  }

  // <link rel="icon"> & variantes
  const iconLinks = [...html.matchAll(/<link\b[^>]*>/gi)];
  for (const [tag] of iconLinks) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "";
    if (!/(icon|apple-touch|mask-icon|shortcut)/i.test(rel)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const abs = absolutize(href, pageUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    assets.push({
      type: "icon",
      originalUrl: abs,
      sourcePageUrl: pageUrl,
    });
  }

  // og:image & twitter:image
  for (const prop of ["og:image", "og:image:url", "twitter:image"]) {
    const content = metaContent(html, prop);
    if (!content) continue;
    const abs = absolutize(content, pageUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    assets.push({
      type: "image",
      originalUrl: abs,
      sourcePageUrl: pageUrl,
    });
  }

  // background-image em style="" inline
  const styleAttrs = [...html.matchAll(/\bstyle=["']([^"']+)["']/gi)];
  for (const [, style] of styleAttrs) {
    const bg = style.match(/background(?:-image)?:\s*[^;]*url\(["']?([^"')]+)["']?\)/i);
    if (!bg) continue;
    const abs = absolutize(bg[1], pageUrl);
    if (!abs || seen.has(abs) || abs.startsWith("data:")) continue;
    seen.add(abs);
    assets.push({
      type: classify(abs),
      originalUrl: abs,
      sourcePageUrl: pageUrl,
    });
  }

  // SVGs inline (extração via tag self-contained em <svg>...</svg>)
  // Por ora, ignoramos — fase deep (Puppeteer) cuidará disso.

  // Font files referenciados em @font-face ou <link rel="preload" as="font">
  const preloadFonts = [...html.matchAll(/<link\b[^>]*\bas=["']font["'][^>]*>/gi)];
  for (const [tag] of preloadFonts) {
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const abs = absolutize(href, pageUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    assets.push({ type: "font", originalUrl: abs, sourcePageUrl: pageUrl });
  }

  return assets;
}

function match(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1] : null;
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byProperty = html.match(
    new RegExp(`<meta\\b[^>]*\\b(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  );
  if (!byProperty) return null;
  const content = byProperty[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}

function absolutize(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseIntOrUndef(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}
