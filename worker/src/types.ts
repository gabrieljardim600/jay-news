export type AssetType = "logo" | "icon" | "image" | "font" | "screenshot";

export interface RawAsset {
  type: AssetType;
  originalUrl: string;
  sourcePageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ColorOccurrence {
  hex: string;
  sources: string[];
  occurrences: number;
}

export interface PageMeta {
  url: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
  screenshotPath?: string;
}

export interface DeepScrapeResult {
  rootUrl: string;
  domain: string;
  pages: PageMeta[];
  assets: RawAsset[];
  colors: ColorOccurrence[];
  fontFamilies: string[];
  screenshots: Array<{ pageUrl: string; buffer: Buffer }>;
}

export interface DownloadedAsset extends RawAsset {
  storagePath: string;
  publicUrl: string;
  fileSizeKb: number;
  mimeType: string;
}

export interface BrandScrapeRow {
  id: string;
  user_id: string;
  root_url: string;
  domain: string;
  urls_to_scrape: string[];
  engine: "light" | "deep";
  intent: string | null;
  parceiro_id: string | null;
}
