import puppeteer, { type Browser, type Page } from "puppeteer";
import type {
  AssetType,
  ColorOccurrence,
  DeepScrapeResult,
  PageMeta,
  RawAsset,
} from "./types.js";

const PAGE_TIMEOUT = 45000;
const MAX_ASSETS = 120;

/**
 * Fase deep: roda Puppeteer real no domínio. Captura
 *  - assets carregados dinamicamente (via request interception)
 *  - cores computadas de :root e stylesheets reais
 *  - screenshot fullPage por página
 *
 * Equivale ao btg-scraper.js do repo raiz, mas portado pra TS e dentro do worker.
 */
export async function runDeepScrape(
  rootUrl: string,
  urls: string[]
): Promise<DeepScrapeResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const domain = extractDomain(rootUrl);
    const pages: PageMeta[] = [];
    const assets = new Map<string, RawAsset>();
    const colorBuckets = new Map<string, ColorOccurrence>();
    const fontFamilies = new Set<string>();
    const screenshots: Array<{ pageUrl: string; buffer: Buffer }> = [];

    const targetUrls = urls.length > 0 ? urls : [rootUrl];

    for (const pageUrl of targetUrls) {
      const result = await scrapeOnePage(browser, pageUrl);
      if (!result) continue;

      pages.push(result.meta);
      if (result.screenshot) screenshots.push({ pageUrl, buffer: result.screenshot });

      for (const asset of result.assets) {
        if (!assets.has(asset.originalUrl)) assets.set(asset.originalUrl, asset);
      }
      for (const c of result.colors) {
        const existing = colorBuckets.get(c.hex);
        if (existing) {
          existing.occurrences += c.occurrences;
          for (const src of c.sources) {
            if (!existing.sources.includes(src)) existing.sources.push(src);
          }
        } else {
          colorBuckets.set(c.hex, { ...c });
        }
      }
      for (const f of result.fonts) fontFamilies.add(f);
    }

    const assetsArr = [...assets.values()].slice(0, MAX_ASSETS);
    const colorsArr = [...colorBuckets.values()].sort(
      (a, b) => b.occurrences - a.occurrences
    );

    return {
      rootUrl,
      domain,
      pages,
      assets: assetsArr,
      colors: colorsArr,
      fontFamilies: [...fontFamilies],
      screenshots,
    };
  } finally {
    await browser.close();
  }
}

interface PageScrapeResult {
  meta: PageMeta;
  assets: RawAsset[];
  colors: ColorOccurrence[];
  fonts: string[];
  screenshot?: Buffer;
}

async function scrapeOnePage(
  browser: Browser,
  pageUrl: string
): Promise<PageScrapeResult | null> {
  const page = await browser.newPage();
  const interceptedAssets: RawAsset[] = [];

  try {
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      const type = req.resourceType();
      if (type === "image" || type === "font") {
        interceptedAssets.push({
          type: classifyAssetType(url, type),
          originalUrl: url,
          sourcePageUrl: pageUrl,
        });
      }
      req.continue();
    });

    try {
      await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT });
    } catch (err) {
      console.warn(`[worker] goto warn ${pageUrl}:`, err instanceof Error ? err.message : err);
      // tenta de novo com critério mais leniente — algumas páginas nunca atingem networkidle2
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
      } catch (err2) {
        console.error(`[worker] goto FAIL ${pageUrl}:`, err2 instanceof Error ? err2.message : err2);
      }
    }

    // Metadata
    const meta = await page.evaluate(() => {
      const title = document.title || undefined;
      const descMeta = document.querySelector(
        'meta[name="description"], meta[property="og:description"]'
      );
      const description = descMeta?.getAttribute("content") ?? undefined;
      const iconLink = document.querySelector(
        'link[rel~="icon"], link[rel~="shortcut"], link[rel~="apple-touch-icon"]'
      );
      const faviconUrl = iconLink?.getAttribute("href") ?? undefined;
      return { title, description, faviconUrl };
    });

    // DOM assets
    const domAssets: RawAsset[] = await page.evaluate((baseUrl) => {
      const urls = new Map<string, { type: string; alt?: string; width?: number; height?: number }>();
      const classify = (url: string) => {
        const lower = url.toLowerCase();
        if (/\b(logo|brand)\b/.test(lower)) return "logo";
        if (/\b(icon|favicon|sprite)\b/.test(lower) || lower.endsWith(".ico")) return "icon";
        return "image";
      };
      const push = (
        raw: string,
        extras: { alt?: string; width?: number; height?: number } = {}
      ) => {
        try {
          const abs = new URL(raw, baseUrl).href;
          if (abs.startsWith("data:")) return;
          if (!urls.has(abs)) urls.set(abs, { type: classify(abs), ...extras });
        } catch {}
      };

      document.querySelectorAll("img").forEach((img) => {
        const extras = {
          alt: img.getAttribute("alt") ?? undefined,
          width: img.naturalWidth || undefined,
          height: img.naturalHeight || undefined,
        };
        ["src", "data-src", "data-lazy", "data-original"].forEach((attr) => {
          const v = img.getAttribute(attr);
          if (v) push(v, extras);
        });
        const srcset = img.getAttribute("srcset") || img.srcset;
        if (srcset) {
          srcset.split(",").forEach((p) => {
            const u = p.trim().split(/\s+/)[0];
            if (u) push(u, extras);
          });
        }
      });

      document
        .querySelectorAll<HTMLLinkElement>(
          'link[rel~="icon"], link[rel~="apple-touch-icon"], link[rel~="shortcut"]'
        )
        .forEach((el) => {
          const href = el.getAttribute("href");
          if (href) push(href);
        });

      document.querySelectorAll("*").forEach((el) => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        if (bg && bg !== "none") {
          const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (m && m[1]) push(m[1]);
        }
      });

      return Array.from(urls.entries()).map(([url, meta]) => ({
        type: meta.type as "logo" | "icon" | "image",
        originalUrl: url,
        sourcePageUrl: baseUrl,
        alt: meta.alt,
        width: meta.width,
        height: meta.height,
      }));
    }, pageUrl);

    // Cores computadas
    const colorData = await page.evaluate(() => {
      const HEX_RE = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
      const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/g;
      const found = new Map<string, { sources: string[]; occurrences: number }>();
      const fonts = new Set<string>();

      const bump = (hex: string, source: string) => {
        const clean = hex.toLowerCase();
        let norm: string | null = null;
        if (/^#[0-9a-f]{3}$/.test(clean)) {
          norm = `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
        } else if (/^#[0-9a-f]{6}$/.test(clean)) {
          norm = clean;
        }
        if (!norm) return;
        const existing = found.get(norm);
        if (existing) {
          existing.occurrences++;
          if (!existing.sources.includes(source)) existing.sources.push(source);
        } else {
          found.set(norm, { sources: [source], occurrences: 1 });
        }
      };

      const addText = (text: string, source: string) => {
        for (const m of text.matchAll(HEX_RE)) bump(m[0], source);
        for (const m of text.matchAll(RGB_RE)) {
          const r = +m[1], g = +m[2], b = +m[3];
          if ([r, g, b].some((n) => n < 0 || n > 255)) continue;
          const toHex = (n: number) => n.toString(16).padStart(2, "0");
          bump(`#${toHex(r)}${toHex(g)}${toHex(b)}`, source);
        }
      };

      const root = document.querySelector(":root");
      if (root) {
        const computed = getComputedStyle(root);
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          if (prop.startsWith("--")) addText(computed.getPropertyValue(prop).trim(), "css_var");
        }
      }

      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = (sheet as CSSStyleSheet).cssRules;
            if (!rules) continue;
            for (const rule of Array.from(rules)) addText(rule.cssText || "", "stylesheet");
          } catch {}
        }
      } catch {}

      document.querySelectorAll("[style]").forEach((el) => {
        const s = el.getAttribute("style");
        if (s) addText(s, "inline");
      });

      document.querySelectorAll("*").forEach((el) => {
        const s = window.getComputedStyle(el);
        const family = s.fontFamily;
        if (family) {
          family.split(",").forEach((f) => {
            const name = f.trim().replace(/^["']|["']$/g, "");
            if (name && !["inherit", "initial", "sans-serif", "serif", "monospace", "system-ui"].includes(name.toLowerCase())) {
              fonts.add(name);
            }
          });
        }
      });

      return {
        colors: Array.from(found.entries()).map(([hex, v]) => ({ hex, ...v })),
        fonts: Array.from(fonts),
      };
    });

    // Screenshot
    let screenshot: Buffer | undefined;
    try {
      const shot = await page.screenshot({ fullPage: true, type: "png" });
      screenshot = Buffer.isBuffer(shot) ? shot : Buffer.from(shot);
    } catch {}

    // Consolida assets DOM + intercepted
    const seen = new Set<string>();
    const merged: RawAsset[] = [];
    for (const a of [...domAssets, ...interceptedAssets]) {
      if (seen.has(a.originalUrl)) continue;
      seen.add(a.originalUrl);
      merged.push(a);
    }

    console.log(
      `[worker] scraped ${pageUrl} — title="${meta.title ?? ""}" assets=${merged.length} colors=${colorData.colors.length} fonts=${colorData.fonts.length} screenshot=${screenshot ? screenshot.length : 0}b`
    );
    return {
      meta: {
        url: pageUrl,
        title: meta.title,
        description: meta.description,
        faviconUrl: meta.faviconUrl ? absolutize(meta.faviconUrl, pageUrl) : undefined,
      },
      assets: merged,
      colors: colorData.colors,
      fonts: colorData.fonts,
      screenshot,
    };
  } catch (err) {
    console.error(`[worker] scrapeOnePage ERR ${pageUrl}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    await page.close();
  }
}

function classifyAssetType(url: string, resourceType: string): AssetType {
  if (resourceType === "font") return "font";
  const lower = url.toLowerCase();
  if (/\b(logo|brand)\b/.test(lower)) return "logo";
  if (/\b(icon|favicon|sprite)\b/.test(lower) || lower.endsWith(".ico")) return "icon";
  return "image";
}

function extractDomain(input: string): string {
  const normalized = input.includes("://") ? input : `https://${input}`;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

function absolutize(raw: string, base: string): string | undefined {
  try {
    return new URL(raw, base).href;
  } catch {
    return undefined;
  }
}
