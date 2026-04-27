import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTarget } from "@/lib/social-brand/collector";
import { generateBriefingForUser } from "@/lib/social-brand/briefing";
import type { SocialBrandTarget } from "@/lib/social-brand/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: targets } = await admin
    .from("social_brand_targets")
    .select("*")
    .eq("is_active", true);

  const all = (targets ?? []) as SocialBrandTarget[];
  const byUser = new Map<string, SocialBrandTarget[]>();
  for (const t of all) {
    const arr = byUser.get(t.user_id) ?? [];
    arr.push(t);
    byUser.set(t.user_id, arr);
  }

  const results: Array<{
    user_id: string;
    targets: number;
    new_posts: number;
    archived: number;
    briefing_id: string | null;
    errors: string[];
  }> = [];

  for (const [userId, list] of byUser) {
    let newPosts = 0;
    let archived = 0;
    const errors: string[] = [];
    for (const t of list) {
      try {
        const r = await syncTarget(admin, t);
        newPosts += r.new_posts;
        archived += r.archived;
        if (r.error) errors.push(`${t.label}: ${r.error}`);
      } catch (e) {
        errors.push(`${t.label}: ${String(e)}`);
      }
    }

    let briefingId: string | null = null;
    try {
      const briefing = await generateBriefingForUser(admin, userId);
      briefingId = briefing?.id ?? null;
    } catch (e) {
      errors.push(`briefing: ${String(e)}`);
    }

    results.push({
      user_id: userId,
      targets: list.length,
      new_posts: newPosts,
      archived,
      briefing_id: briefingId,
      errors,
    });
  }

  return NextResponse.json({ ok: true, usersProcessed: results.length, results });
}
