import type { DesignSystem } from "./design-system-builder.js";

/**
 * Gera HTML preview do design system (equivalente ao btg-whitelabel-cores.html que o Gabriel
 * curou manualmente no scrape do BTG).
 */
export function renderDesignSystemHtml(ds: DesignSystem): string {
  const brandName = escapeHtml(ds.brand.name);
  const domain = escapeHtml(ds.brand.domain);
  const tagline = ds.brand.tagline ? escapeHtml(ds.brand.tagline) : "";

  const roleSwatches = [
    ds.colors.primary && swatch("Primary", ds.colors.primary.hex),
    ds.colors.secondary && swatch("Secondary", ds.colors.secondary.hex),
    ds.colors.accent && swatch("Accent", ds.colors.accent.hex),
    ds.colors.background && swatch("Background", ds.colors.background.hex),
    ds.colors.text && swatch("Text", ds.colors.text.hex),
  ]
    .filter(Boolean)
    .join("\n");

  const neutralSwatches = ds.colors.neutral
    .map((n, i) => swatch(`Neutral ${i + 1}`, n.hex))
    .join("\n");

  const logoHtml = ds.logos.variants.length
    ? `<div class="logos">${ds.logos.variants
        .map((u) => `<div class="logo-card"><img src="${escapeAttr(u)}" alt="logo"/></div>`)
        .join("")}</div>`
    : `<p class="muted">Nenhum logo identificado.</p>`;

  const typo = [
    ds.typography.heading_font && `<div><span class="label">Heading</span><span class="value">${escapeHtml(ds.typography.heading_font)}</span></div>`,
    ds.typography.primary_font && `<div><span class="label">Body</span><span class="value">${escapeHtml(ds.typography.primary_font)}</span></div>`,
    ds.typography.mono_font && `<div><span class="label">Mono</span><span class="value">${escapeHtml(ds.typography.mono_font)}</span></div>`,
  ]
    .filter(Boolean)
    .join("");

  const cssVars = [
    ds.colors.primary && `  --color-primary: ${ds.colors.primary.hex};`,
    ds.colors.secondary && `  --color-secondary: ${ds.colors.secondary.hex};`,
    ds.colors.accent && `  --color-accent: ${ds.colors.accent.hex};`,
    ds.colors.background && `  --color-background: ${ds.colors.background.hex};`,
    ds.colors.text && `  --color-text: ${ds.colors.text.hex};`,
    ...ds.colors.neutral.map((n, i) => `  --color-neutral-${(i + 1) * 100}: ${n.hex};`),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${brandName} — Design System</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0d0d0d; color: #fff; padding: 2.5rem; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.25rem; }
  .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 2.5rem; }
  h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #555; margin: 2.5rem 0 1rem; font-weight: 600; }
  .swatches { display: flex; flex-wrap: wrap; gap: 12px; }
  .swatch { display: flex; flex-direction: column; width: 160px; }
  .swatch-box { width: 160px; height: 80px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
  .swatch-info { padding: 8px 2px 0; }
  .swatch-name { font-size: 11px; font-weight: 600; color: #ccc; display: block; }
  .swatch-hex { font-size: 10px; color: #666; font-family: monospace; display: block; margin-top: 2px; }
  .muted { color: #555; font-size: 12px; }
  .logos { display: flex; flex-wrap: wrap; gap: 16px; }
  .logo-card { padding: 16px; border-radius: 8px; background: #1a1a1a; border: 1px solid #222; display: flex; align-items: center; justify-content: center; min-height: 80px; }
  .logo-card img { max-width: 180px; max-height: 60px; }
  .typo { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .typo > div { background: #151515; border: 1px solid #222; border-radius: 8px; padding: 16px; }
  .typo .label { display: block; font-size: 10px; text-transform: uppercase; color: #555; letter-spacing: 0.1em; margin-bottom: 6px; }
  .typo .value { font-size: 14px; color: #eee; }
  pre { background: #111; border: 1px solid #222; border-radius: 10px; padding: 1.4rem 1.6rem; font-size: 12px; font-family: 'Cascadia Code', monospace; color: #9cdcfe; overflow-x: auto; line-height: 1.7; margin-top: 1rem; }
  .notes { background: #151515; border: 1px solid #222; border-radius: 8px; padding: 16px; font-size: 13px; color: #bbb; line-height: 1.6; }
</style>
</head>
<body>
  <h1>${brandName}</h1>
  <p class="subtitle">${domain}${tagline ? ` · ${tagline}` : ""}</p>

  <h2>Brand Colors</h2>
  <div class="swatches">${roleSwatches || '<p class="muted">Nenhuma cor de marca identificada.</p>'}</div>

  ${neutralSwatches ? `<h2>Neutrals</h2><div class="swatches">${neutralSwatches}</div>` : ""}

  <h2>Typography</h2>
  <div class="typo">${typo || '<p class="muted">Nenhuma tipografia identificada.</p>'}</div>

  <h2>Logos</h2>
  ${logoHtml}

  ${ds.notes ? `<h2>Notes</h2><div class="notes">${escapeHtml(ds.notes)}</div>` : ""}

  <h2>CSS Variables</h2>
  <pre>:root {
${cssVars}
}</pre>
</body>
</html>`;
}

function swatch(label: string, hex: string): string {
  return `<div class="swatch">
    <div class="swatch-box" style="background:${escapeAttr(hex)}"></div>
    <div class="swatch-info">
      <span class="swatch-name">${escapeHtml(label)}</span>
      <span class="swatch-hex">${escapeHtml(hex)}</span>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string { return escapeHtml(s); }
