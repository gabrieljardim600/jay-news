import type { SupabaseClient } from "@supabase/supabase-js";
import type { DownloadedAsset, RawAsset } from "./types";

const FETCH_TIMEOUT = 15000;
const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5MB por asset

/**
 * Baixa um asset, faz upload pro Supabase Storage, retorna storage path + public URL.
 * Retorna null em caso de falha (não throw) pra scrape parcial não quebrar tudo.
 */
export async function downloadAndUpload(
  supabase: SupabaseClient,
  asset: RawAsset,
  scrapeId: string
): Promise<DownloadedAsset | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const response = await fetch(asset.originalUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JayNewsBrandScraper/1.0)",
        Accept: "*/*",
        Referer: asset.sourcePageUrl,
      },
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_ASSET_BYTES) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_ASSET_BYTES) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const ext = extensionFor(asset.originalUrl, contentType);
    const filename = safeFilename(asset.originalUrl, ext);
    const storagePath = `${scrapeId}/${asset.type}/${filename}`;

    const { error } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
    if (error) return null;

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(storagePath);

    return {
      ...asset,
      storagePath,
      publicUrl: urlData.publicUrl,
      fileSizeKb: Math.round(arrayBuffer.byteLength / 1024),
      mimeType: contentType,
    };
  } catch {
    return null;
  }
}

function extensionFor(url: string, contentType: string): string {
  const fromUrl = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (fromUrl && ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "avif", "woff", "woff2", "ttf", "otf"].includes(fromUrl)) {
    return fromUrl === "jpeg" ? "jpg" : fromUrl;
  }
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("x-icon") || contentType.includes("icon")) return "ico";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("woff2")) return "woff2";
  if (contentType.includes("woff")) return "woff";
  if (contentType.includes("ttf")) return "ttf";
  if (contentType.includes("otf")) return "otf";
  return "bin";
}

function safeFilename(url: string, ext: string): string {
  const basename = url.split("?")[0].split("/").pop() || "asset";
  const stripped = basename.replace(/\.[a-z0-9]+$/i, "");
  const sanitized = stripped.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80) || "asset";
  const suffix = `-${Math.random().toString(36).slice(2, 8)}`;
  return `${sanitized}${suffix}.${ext}`;
}
