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

Rules:
- Prefer hex values that appear frequently AND from multiple sources.
- Reject noisy colors (ads, tracking, widgets).
- Do NOT hallucinate colors.
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

  return {
    brand: {
      name: ai.brand_name ?? input.domain,
      domain: input.domain,
      tagline: ai.tagline,
    },
    colors: {
      primary: toRole(ai.colors?.primary, "primary", 0.9),
      secondary: toRole(ai.colors?.secondary, "secondary", 0.8),
      accent: toRole(ai.colors?.accent, "accent", 0.8),
      neutral: neutrals,
      background: toRole(ai.colors?.background, "background", 0.85),
      text: toRole(ai.colors?.text, "text", 0.85),
      noise: ai.colors?.noise ?? [],
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
