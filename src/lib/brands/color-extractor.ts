import type { ColorOccurrence } from "./types";

const HEX_RE = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;

/**
 * Extrai cores de HTML + stylesheets externas opcionais.
 * Fontes: inline styles, <style>, CSS variables em :root, CSS files externos carregados.
 */
export async function extractColors(
  html: string,
  pageUrl: string
): Promise<{ colors: ColorOccurrence[]; fontFamilies: string[] }> {
  const buckets = new Map<string, ColorOccurrence>();
  const fonts = new Set<string>();

  addFromText(html, "inline", buckets);
  collectFontFamiliesFromText(html, fonts);

  // <style> tags
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const [, css] of styles) {
    addFromText(css, "stylesheet", buckets);
    if (css.includes(":root")) addFromText(css, "css_var", buckets);
    collectFontFamiliesFromText(css, fonts);
  }

  // CSS externos
  const links = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)];
  const cssUrls = links
    .map(([tag]) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter((u): u is string => !!u)
    .slice(0, 5);

  for (const href of cssUrls) {
    const absolute = absolutize(href, pageUrl);
    if (!absolute) continue;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(absolute, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const css = await response.text();
      addFromText(css, "stylesheet", buckets);
      if (css.includes(":root") || css.includes("--")) addFromText(css, "css_var", buckets);
      collectFontFamiliesFromText(css, fonts);
    } catch {
      // ignore
    }
  }

  return {
    colors: [...buckets.values()].sort((a, b) => b.occurrences - a.occurrences),
    fontFamilies: [...fonts],
  };
}

function addFromText(
  text: string,
  source: ColorOccurrence["sources"][number],
  buckets: Map<string, ColorOccurrence>
) {
  for (const match of text.matchAll(HEX_RE)) {
    const normalized = normalizeHex(match[0]);
    if (!normalized) continue;
    bump(buckets, normalized, source);
  }
  for (const match of text.matchAll(RGB_RE)) {
    const [, r, g, b] = match;
    const hex = rgbToHex(+r, +g, +b);
    if (!hex) continue;
    bump(buckets, hex, source);
  }
}

function bump(
  buckets: Map<string, ColorOccurrence>,
  hex: string,
  source: ColorOccurrence["sources"][number]
) {
  const existing = buckets.get(hex);
  if (existing) {
    existing.occurrences += 1;
    if (!existing.sources.includes(source)) existing.sources.push(source);
  } else {
    buckets.set(hex, { hex, sources: [source], occurrences: 1 });
  }
}

function normalizeHex(raw: string): string | null {
  const clean = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    return (
      "#" +
      clean[1] + clean[1] +
      clean[2] + clean[2] +
      clean[3] + clean[3]
    );
  }
  if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
  return null;
}

function rgbToHex(r: number, g: number, b: number): string | null {
  if ([r, g, b].some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

function absolutize(raw: string, base: string): string | null {
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

function collectFontFamiliesFromText(text: string, fonts: Set<string>) {
  const fontFaceMatches = [...text.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*["']?([^"';}]+)["']?/gi)];
  for (const m of fontFaceMatches) {
    const name = m[1].trim();
    if (name) fonts.add(name);
  }
  const familyMatches = [...text.matchAll(/font-family\s*:\s*([^;}"]+)[;}]/gi)];
  for (const m of familyMatches) {
    const list = m[1]
      .replace(/["']/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !isGenericFontKeyword(s));
    for (const name of list) fonts.add(name);
  }
}

function isGenericFontKeyword(name: string): boolean {
  return [
    "inherit",
    "initial",
    "unset",
    "revert",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "-apple-system",
    "BlinkMacSystemFont",
  ].some((k) => k.toLowerCase() === name.toLowerCase());
}
