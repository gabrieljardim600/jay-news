import { getAnthropicClient } from "@/lib/anthropic/client";
import type {
  ColorOccurrence,
  DesignSystem,
  DesignSystemRole,
  DownloadedAsset,
  PageMeta,
} from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_COLORS_TO_CLASSIFY = 60;

interface BuilderInput {
  domain: string;
  pages: PageMeta[];
  colors: ColorOccurrence[];
  fontFamilies: string[];
  assets: DownloadedAsset[];
}

/**
 * Usa Haiku pra classificar cores em roles (primary/secondary/accent/neutral/noise),
 * identificar logo principal, e gerar um design system estruturado.
 */
export async function buildDesignSystem(input: BuilderInput): Promise<DesignSystem> {
  const topColors = input.colors.slice(0, MAX_COLORS_TO_CLASSIFY);
  const logos = input.assets.filter((a) => a.type === "logo");
  const primaryPage = input.pages[0] ?? { url: `https://${input.domain}` };

  const prompt = buildPrompt({
    domain: input.domain,
    title: primaryPage.title,
    description: primaryPage.description,
    colors: topColors,
    fontFamilies: input.fontFamilies,
    logoUrls: logos.map((l) => l.originalUrl ?? l.publicUrl).filter(Boolean),
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  let parsed: Partial<AIDesignSystem> = {};
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as AIDesignSystem;
    } catch {
      // fallback abaixo
    }
  }

  return composeSystem(input, parsed);
}

interface AIDesignSystem {
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
  typography?: {
    primary_font?: string;
    heading_font?: string;
    mono_font?: string;
  };
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
    .map((c) => `  ${c.hex} — occurrences: ${c.occurrences}, sources: ${c.sources.join(",")}`)
    .join("\n");
  const fontLines = ctx.fontFamilies.slice(0, 25).map((f) => `  ${f}`).join("\n") || "  (none)";
  const logoLines = ctx.logoUrls.slice(0, 10).map((u) => `  ${u}`).join("\n") || "  (none)";

  return `You are a brand & design system analyst. Given raw data scraped from a website, classify the visual brand.

Domain: ${ctx.domain}
Page title: ${ctx.title ?? "(unknown)"}
Description: ${ctx.description ?? "(unknown)"}

Colors extracted (hex, occurrence count, sources):
${colorLines || "  (none)"}

Font families found:
${fontLines}

Candidate logo URLs:
${logoLines}

Your task: produce a single JSON object with this shape:

{
  "brand_name": "<human-readable brand name>",
  "tagline": "<short tagline if evident, else null>",
  "colors": {
    "primary":    "<hex, the main brand color — the one users identify the brand with>",
    "secondary":  "<hex, supporting brand color, or null>",
    "accent":     "<hex, highlight/CTA color, or null>",
    "background": "<hex, main page background, usually white/black or near-neutral>",
    "text":       "<hex, main text color>",
    "neutrals":   ["<3-6 hex values used for borders, muted text, surfaces>"],
    "noise":      ["<hex values that are clearly 3rd-party ads, widgets, or tracking pixels — low signal for the brand>"]
  },
  "typography": {
    "primary_font":  "<main body font-family, or null>",
    "heading_font":  "<headings font-family if distinct, or null>",
    "mono_font":     "<monospace font if present, or null>"
  },
  "primary_logo_url": "<the URL that best represents the brand's primary logo, or null>",
  "notes": "<1-2 sentences on visual identity, tone, or distinctive treatment>"
}

Rules for color classification:
- Primary = the single most identifiable BRAND chrome color (what a human would name if asked "what color is this brand"). Examples: XP Investimentos → yellow, Nubank → purple, Itaú → orange. It's almost never white, black, or gray.
- Do NOT pick white/near-white as primary — that goes to "background".
- Do NOT pick pure black/near-black as primary unless the brand is genuinely black-on-white monochrome AND no saturated brand color exists.
- Among saturated (non-gray) colors, prefer the one that appears most often across multiple sources.
- Secondary & accent are OPTIONAL. Only pick them if they clearly repeat across multiple sources AND have at least ~30% of the primary's occurrence count. If unsure, return null — returning null is strongly preferred over guessing.
- Reject "UI state indicator" colors unless they clearly dominate the chrome:
    * green (#0a9e5a, #16a34a, #22c55e, etc.) = up/positive/success indicator — common in fintech tickers
    * red (#dc2626, #ef4444, #cc3333, etc.) = down/negative/error indicator
    * orange/amber in isolation = warning indicator
  These look saturated and catch the eye, but they are almost never the brand accent. Put them in "noise" instead.
- Reject 3rd-party widget colors: Google blue (#4285f4), Facebook blue (#1877f2), Instagram gradient pinks, YouTube red (#ff0000), WhatsApp green (#25d366), Twitter/X blue, tracking pixel colors.
- Prefer hex values that appear frequently AND from multiple sources (stylesheet + css_var > inline alone).
- Do NOT hallucinate colors that aren't in the list.
- Pick fonts that look like BRAND fonts, not generic system stacks.
- Return ONLY the JSON object, no markdown fences, no prose.`;
}

function composeSystem(input: BuilderInput, ai: Partial<AIDesignSystem>): DesignSystem {
  const toRole = (
    hex: string | undefined,
    role: DesignSystemRole["role"],
    confidence = 0.8
  ): DesignSystemRole | undefined => {
    if (!hex) return undefined;
    const normalized = hex.toLowerCase();
    const occurrence = input.colors.find((c) => c.hex === normalized);
    return {
      name: nameFor(role),
      hex: normalized,
      role,
      confidence: occurrence ? Math.min(1, confidence + 0.1) : confidence,
    };
  };

  const neutralRoles: DesignSystemRole[] = (ai.colors?.neutrals ?? [])
    .map((hex) => toRole(hex, "neutral"))
    .filter((r): r is DesignSystemRole => !!r);

  const logosInInput = input.assets.filter((a) => a.type === "logo");
  const primaryLogoUrl =
    logosInInput.find((l) => l.originalUrl === ai.primary_logo_url)?.publicUrl ??
    logosInInput[0]?.publicUrl;

  const primaryRole = toRole(ai.colors?.primary, "primary", 0.9);
  const primaryOcc = primaryRole
    ? input.colors.find((c) => c.hex === primaryRole.hex)?.occurrences ?? 0
    : 0;

  // Filtro de dominância — secondary/accent só passam se aparecerem com
  // frequência relevante vs o primary. Evita que cores de estado (verde up,
  // vermelho down, amarelo warning) sejam rotuladas como brand.
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
      neutral: neutralRoles,
      background: toRole(ai.colors?.background, "background", 0.85),
      text: toRole(ai.colors?.text, "text", 0.85),
      noise: [...(ai.colors?.noise ?? []), ...droppedIntoNoise],
    },
    typography: {
      primary_font: ai.typography?.primary_font ?? undefined,
      heading_font: ai.typography?.heading_font ?? undefined,
      mono_font: ai.typography?.mono_font ?? undefined,
      all_fonts: input.fontFamilies,
    },
    logos: {
      primary: primaryLogoUrl,
      variants: logosInInput.map((l) => l.publicUrl),
    },
    notes: ai.notes,
  };
}

function nameFor(role: DesignSystemRole["role"]): string {
  switch (role) {
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "accent":
      return "Accent";
    case "neutral":
      return "Neutral";
    case "background":
      return "Background";
    case "text":
      return "Text";
    default:
      return role;
  }
}
