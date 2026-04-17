export type AssetType = "logo" | "icon" | "image" | "font" | "screenshot";
export type ScrapeIntent = "whitelabel" | "inspiration" | "competitor";
export type ScrapeStatus =
  | "pending"
  | "crawling"
  | "scraping"
  | "enriching"
  | "completed"
  | "failed";
export type ScrapeEngine = "light" | "deep";

export interface RawAsset {
  type: AssetType;
  originalUrl: string;
  sourcePageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface DownloadedAsset extends RawAsset {
  storagePath: string;
  publicUrl: string;
  fileSizeKb: number;
  mimeType: string;
}

export interface ColorOccurrence {
  hex: string;
  sources: Array<"css_var" | "stylesheet" | "inline" | "computed">;
  occurrences: number;
}

export interface PageMeta {
  url: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
  ogImage?: string;
}

export interface LightScrapeResult {
  rootUrl: string;
  domain: string;
  pages: PageMeta[];
  assets: RawAsset[];
  colors: ColorOccurrence[];
  fontFamilies: string[];
}

export interface DesignSystemRole {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "neutral" | "background" | "text" | "noise";
  confidence: number;
}

export interface DesignSystem {
  brand: {
    name: string;
    domain: string;
    tagline?: string;
  };
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
  logos: {
    primary?: string;
    variants: string[];
  };
  notes?: string;
}
