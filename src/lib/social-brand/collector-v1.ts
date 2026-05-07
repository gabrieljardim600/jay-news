// Versão account-scoped do collector. Usada pelas v1 M2M routes.
// Mantém collector.ts legado intacto (escopo user_id, /api/social-brand/* cookie auth).
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

export interface AccountTarget extends SocialBrandTarget {
  account_id: string | null;
  profile_id?: string | null;
}

export async function syncTargetForAccount(
  supabase: SupabaseClient,
  target: AccountTarget,
  accountId: string,
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

    if (Object.keys(profile).length > 0) {
      await supabase
        .from("social_brand_targets")
        .update({
          profile,
          last_synced_at: new Date().toISOString(),
          last_sync_status: "ok",
          last_sync_error: null,
        })
        .eq("id", target.id)
        .eq("account_id", accountId);
    }

    if (posts.length === 0) {
      report.status = "empty";
      return report;
    }

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

    const rows = await Promise.all(
      newPosts.map(async (p) => {
        let archive: { storage_path: string; public_url: string; mime_type: string }[] = [];
        if (target.mode === "archive_posts" && p.media.length > 0) {
          // Path no bucket: account/{accountId}/{targetId}/{external_id}_{i}.{ext}
          // archiveMedia recebe userId no 2º arg; passamos accountId pra escopar por conta.
          archive = await archiveMedia(
            supabase,
            accountId,
            target.id,
            p.external_id,
            p.media,
          );
          report.archived += archive.length;
        }
        return {
          target_id: target.id,
          user_id: target.user_id, // mantém pra compat com tabela legada
          account_id: accountId,
          profile_id: target.profile_id ?? null,
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
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: msg.slice(0, 500),
      })
      .eq("id", target.id)
      .eq("account_id", accountId);
    return report;
  }
}

export async function syncAllForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<SyncReport[]> {
  const { data: targets } = await supabase
    .from("social_brand_targets")
    .select("*")
    .eq("account_id", accountId)
    .eq("is_active", true);

  const reports: SyncReport[] = [];
  for (const t of (targets ?? []) as AccountTarget[]) {
    reports.push(await syncTargetForAccount(supabase, t, accountId));
  }
  return reports;
}
