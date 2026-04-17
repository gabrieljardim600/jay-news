import Anthropic from "@anthropic-ai/sdk";
import type { ColorOccurrence, DownloadedAsset, PageMeta } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_COLORS = 60;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface DesignSystemRole {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "neutral" | "background" | "text" | "noise";
  confidence: number;
}

export interface DesignSystem {
  brand: { name: string; domain: string; tagline?: string };
  colors: {
    primary?: DesignSystemRole;
    secondary?: DesignSystemRole;
    accent?: DesignSystemRole;
    neutral: DesignSystemRole[];
    background?: DesignSystemRole;
    text?: DesignSystemRole;
    noise: string[];
  };
  typography: {
    primary_font?: string;
    heading_font?: string;
    mono_font?: string;
    all_fonts: string[];
  };
  logos: { primary?: string; variants: string[] };
  notes?: string;
}

export async function buildDesignSystem(input: {
  domain: string;
  pages: PageMeta[];
  colors: ColorOccurrence[];
  fontFamilies: string[];
  assets: DownloadedAsset[];
}): Promise<DesignSystem> {
  const topColors = input.colors.slice(0, MAX_COLORS);
  const logos = input.assets.filter((a) => a.type === "logo");
  const primary = input.pages[0];

  const prompt = buildPrompt({
    domain: input.domain,
    title: primary?.title,
    description: primary?.description,
    colors: topColors,
    fontFamilies: input.fontFamilies,
    logoUrls: logos.map((l) => l.originalUrl),
  });

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const json = text.match(/\{[\s\S]*\}/);

  let parsed: AIDS = {};
  if (json) {
    try {
      parsed = JSON.parse(json[0]) as AIDS;
    } catch {}
  }
  return compose(input, parsed);
}

interface AIDS {
  brand_name?: string;
  tagline?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    neutrals?: string[];
    noise?: string[];
  };
  typography?: { primary_font?: string; heading_font?: string; mono_font?: string };
  primary_logo_url?: string;
  notes?: string;
}

function buildPrompt(ctx: {
  domain: string;
  title?: string;
  description?: string;
  colors: ColorOccurrence[];
  fontFamilies: string[];
  logoUrls: string[];
}): string {
  const colorLines = ctx.colors
    .map((c) => `  ${c.hex} — occ:${c.occurrences}, src:${c.sources.join(",")}`)
    .join("\n");
  const fontLines = ctx.fontFamilies.slice(0, 25).map((f) => `  ${f}`).join("\n") || "  (none)";
  const logoLines = ctx.logoUrls.slice(0, 10).map((u) => `  ${u}`).join("\n") || "  (none)";

  return `You are a brand & design system analyst. Given raw data scraped from a website, classify the visual brand.

Domain: ${ctx.domain}
Page title: ${ctx.title ?? "(unknown)"}
Description: ${ctx.description ?? "(unknown)"}

Colors (hex, occurrence count, sources):
${colorLines || "  (none)"}

Fonts:
${fontLines}

Candidate logos:
${logoLines}

Produce a JSON object with the following structure:

{
  "brand_name": "<human-readable brand name>",
  "tagline": "<short tagline if evident, else null>",
  "colors": {
    "primary":    "<hex>",
    "secondary":  "<hex or null>",
    "accent":     "<hex or null>",
    "background": "<hex>",
    "text":       "<hex>",
    "neutrals":   ["<3-6 hex values>"],
    "noise":      ["<noisy/3rd-party colors>"]
  },
  "typography": {
    "primary_font":  "<font-family or null>",
    "heading_font":  "<font-family or null>",
    "mono_font":     "<font-family or null>"
  },
  "primary_logo_url": "<best logo URL or null>",
  "notes": "<1-2 sentences on visual identity>"
}

Rules for color classification:
- Primary = the dominant brand chrome color. Must be in the top of the list by occurrence.
- Secondary & accent are OPTIONAL. Only pick them if they clearly repeat across multiple sources AND have at least ~30% of the primary's occurrence count. If you're unsure, return null — returning null is strongly preferred over guessing.
- Reject "UI state indicator" colors unless they clearly dominate the chrome:
    * green (#0a9e5a, #16a34a, #22c55e, etc.) = up/positive/success indicator — common in fintech tickers
    * red (#dc2626, #ef4444, #cc3333, etc.) = down/negative/error indicator
    * orange/amber in isolation = warning indicator
  These look saturated and catch the eye, but they are almost never the brand accent. Put them in "noise" instead.
- Reject 3rd-party widget colors: Google blue (#4285f4), Facebook blue (#1877f2), Meta/Instagram gradient pinks, YouTube red (#ff0000), WhatsApp green (#25d366), Twitter/X blue, tracking pixel colors.
- Prefer hex values that appear frequently AND from multiple sources (stylesheet + css_var > inline alone).
- Do NOT hallucinate colors — only pick from the list.
- Pick BRAND fonts, not generic system stacks.
- Return ONLY the JSON, no markdown fences.`;
}

function compose(
  input: {
    domain: string;
    colors: ColorOccurrence[];
    fontFamilies: string[];
    assets: DownloadedAsset[];
  },
  ai: AIDS
): DesignSystem {
  const toRole = (
    hex: string | undefined,
    role: DesignSystemRole["role"],
    confidence = 0.8
  ): DesignSystemRole | undefined => {
    if (!hex) return undefined;
    const normalized = hex.toLowerCase();
    const occ = input.colors.find((c) => c.hex === normalized);
    return {
      name: roleName(role),
      hex: normalized,
      role,
      confidence: occ ? Math.min(1, confidence + 0.1) : confidence,
    };
  };

  const neutrals = (ai.colors?.neutrals ?? [])
    .map((h) => toRole(h, "neutral"))
    .filter((r): r is DesignSystemRole => !!r);

  const logos = input.assets.filter((a) => a.type === "logo");
  const primaryLogo =
    logos.find((l) => l.originalUrl === ai.primary_logo_url)?.publicUrl ?? logos[0]?.publicUrl;

  const primaryRole = toRole(ai.colors?.primary, "primary", 0.9);
  const primaryOcc = primaryRole
    ? input.colors.find((c) => c.hex === primaryRole.hex)?.occurrences ?? 0
    : 0;

  // Filtro de dominância: secondary/accent só sobrevivem se aparecerem com
  // frequência relevante comparada ao primary. Evita "verde do ticker" ser
  // escolhido como accent em sites fintech. Threshold 20% é conservador.
  const DOMINANCE_RATIO = 0.2;
  const MIN_OCCURRENCES = 3;
  const dominant = (hex: string | undefined): string | undefined => {
    if (!hex || primaryOcc === 0) return hex;
    const occ = input.colors.find((c) => c.hex === hex.toLowerCase())?.occurrences ?? 0;
    if (occ < MIN_OCCURRENCES) return undefined;
    if (occ / primaryOcc < DOMINANCE_RATIO) return undefined;
    return hex;
  };

  const secondaryHex = dominant(ai.colors?.secondary);
  const accentHex = dominant(ai.colors?.accent);

  // Colors filtradas viram noise — pra refletir na UI que não eram brand.
  const droppedIntoNoise: string[] = [];
  if (ai.colors?.secondary && !secondaryHex) droppedIntoNoise.push(ai.colors.secondary.toLowerCase());
  if (ai.colors?.accent && !accentHex) droppedIntoNoise.push(ai.colors.accent.toLowerCase());

  return {
    brand: {
      name: ai.brand_name ?? input.domain,
      domain: input.domain,
      tagline: ai.tagline,
    },
    colors: {
      primary: primaryRole,
      secondary: toRole(secondaryHex, "secondary", 0.8),
      accent: toRole(accentHex, "accent", 0.8),
      neutral: neutrals,
      background: toRole(ai.colors?.background, "background", 0.85),
      text: toRole(ai.colors?.text, "text", 0.85),
      noise: [...(ai.colors?.noise ?? []), ...droppedIntoNoise],
    },
    typography: {
      primary_font: ai.typography?.primary_font,
      heading_font: ai.typography?.heading_font,
      mono_font: ai.typography?.mono_font,
      all_fonts: input.fontFamilies,
    },
    logos: {
      primary: primaryLogo,
      variants: logos.map((l) => l.publicUrl),
    },
    notes: ai.notes,
  };
}

function roleName(role: DesignSystemRole["role"]): string {
  return role[0].toUpperCase() + role.slice(1);
}
