// Orquestra a coleta de um target: chama o fetcher correto, persiste posts novos
// no banco, e (se mode = archive_posts) arquiva mídia pro storage.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchInstagramProfile } from "./instagram";
import { fetchFacebookPage } from "./facebook-page";
import { fetchAdsForIdentifier } from "./meta-ad-library";
import { archiveMedia } from "./archiver";
import type { FetchedPost, FetchedProfile, SocialBrandTarget, SyncReport } from "./types";

async function runFetcher(
  target: SocialBrandTarget,
): Promise<{ profile: FetchedProfile; posts: FetchedPost[] }> {
  switch (target.platform) {
    case "instagram": {
      const r = await fetchInstagramProfile(target.identifier);
      return { profile: r.profile, posts: r.posts };
    }
    case "facebook_page": {
      const r = await fetchFacebookPage(target.identifier);
      return { profile: r.profile, posts: r.posts };
    }
    case "meta_ads": {
      const r = await fetchAdsForIdentifier(target.identifier);
      return { profile: r.profile, posts: r.ads };
    }
    case "tiktok":
      throw new Error("TikTok ainda não suportado nessa versão (precisa Research API)");
  }
}

export async function syncTarget(
  supabase: SupabaseClient,
  target: SocialBrandTarget,
): Promise<SyncReport> {
  const report: SyncReport = {
    target_id: target.id,
    platform: target.platform,
    label: target.label,
    fetched: 0,
    new_posts: 0,
    archived: 0,
    status: "ok",
  };

  try {
    const { profile, posts } = await runFetcher(target);
    report.fetched = posts.length;

    // Atualiza profile do target
    if (Object.keys(profile).length > 0) {
      await supabase
        .from("social_brand_targets")
        .update({ profile, last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_error: null })
        .eq("id", target.id);
    }

    if (posts.length === 0) {
      report.status = "empty";
      return report;
    }

    // Descobre quais external_ids já existem
    const externalIds = posts.map((p) => p.external_id);
    const { data: existingRows } = await supabase
      .from("social_brand_posts")
      .select("external_id")
      .eq("target_id", target.id)
      .in("external_id", externalIds);
    const existing = new Set((existingRows ?? []).map((r: { external_id: string }) => r.external_id));

    const newPosts = posts.filter((p) => !existing.has(p.external_id));
    report.new_posts = newPosts.length;

    if (newPosts.length === 0) return report;

    // Arquiva mídia se modo = archive_posts
    const rows = await Promise.all(
      newPosts.map(async (p) => {
        let archive: { storage_path: string; public_url: string; mime_type: string }[] = [];
        if (target.mode === "archive_posts" && p.media.length > 0) {
          archive = await archiveMedia(supabase, target.user_id, target.id, p.external_id, p.media);
          report.archived += archive.length;
        }
        return {
          target_id: target.id,
          user_id: target.user_id,
          external_id: p.external_id,
          kind: p.kind,
          platform: target.platform,
          caption: p.caption,
          permalink: p.permalink,
          posted_at: p.posted_at,
          media: p.media,
          archive,
          metrics: p.metrics,
          raw: p.raw,
        };
      }),
    );

    const { error } = await supabase
      .from("social_brand_posts")
      .upsert(rows, { onConflict: "target_id,external_id", ignoreDuplicates: true });
    if (error) {
      report.status = "error";
      report.error = error.message;
    }

    return report;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report.status = "error";
    report.error = msg;
    await supabase
      .from("social_brand_targets")
      .update({ last_synced_at: new Date().toISOString(), last_sync_status: "error", last_sync_error: msg.slice(0, 500) })
      .eq("id", target.id);
    return report;
  }
}

export async function syncAllForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SyncReport[]> {
  const { data: targets } = await supabase
    .from("social_brand_targets")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  const reports: SyncReport[] = [];
  for (const t of (targets ?? []) as SocialBrandTarget[]) {
    reports.push(await syncTarget(supabase, t));
  }
  return reports;
}
