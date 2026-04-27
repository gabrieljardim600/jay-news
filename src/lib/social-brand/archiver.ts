// Baixa mídia de URLs do CDN da Meta/Instagram e sobe pro bucket "social-archive".
// URLs do IG/FB CDN expiram em ~24h, então arquivamos o que o usuário marcou pra tracking.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialBrandMediaItem } from "./types";

const BUCKET = "social-archive";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.instagram.com/",
};

function extFromContentType(ct: string): string {
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  return "bin";
}

export interface ArchivedMedia {
  storage_path: string;
  public_url: string;
  mime_type: string;
}

export async function archiveMedia(
  supabase: SupabaseClient,
  userId: string,
  targetId: string,
  externalId: string,
  items: SocialBrandMediaItem[],
): Promise<ArchivedMedia[]> {
  const out: ArchivedMedia[] = [];
  const safeId = String(externalId).replace(/[^a-zA-Z0-9_-]/g, "_");

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.url) continue;
    try {
      const res = await fetch(item.url, { headers: HEADERS });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
      const ext = extFromContentType(contentType);
      const buffer = await res.arrayBuffer();
      const path = `${userId}/${targetId}/${safeId}_${i}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Uint8Array(buffer), { contentType, upsert: true });
      if (uploadErr) continue;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      out.push({ storage_path: path, public_url: pub.publicUrl, mime_type: contentType });
    } catch {
      // skip — origem expirada ou bloqueada
    }
  }
  return out;
}
