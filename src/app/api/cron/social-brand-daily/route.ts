import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncTarget } from "@/lib/social-brand/collector";
import { generateBriefingForUser } from "@/lib/social-brand/briefing";
import {
  syncTargetForAccount,
  type AccountTarget,
} from "@/lib/social-brand/collector-v1";
import { generateBriefingForAccount } from "@/lib/social-brand/briefing-v1";
import type { SocialBrandTarget } from "@/lib/social-brand/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface CronTarget extends SocialBrandTarget {
  account_id: string | null;
}

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

  const all = (targets ?? []) as CronTarget[];

  // Account-scoped (novo: jay-social) vs user-scoped (legacy: jay-news/social)
  const byAccount = new Map<string, CronTarget[]>();
  const byUser = new Map<string, CronTarget[]>();
  for (const t of all) {
    if (t.account_id) {
      const arr = byAccount.get(t.account_id) ?? [];
      arr.push(t);
      byAccount.set(t.account_id, arr);
    } else if (t.user_id) {
      const arr = byUser.get(t.user_id) ?? [];
      arr.push(t);
      byUser.set(t.user_id, arr);
    }
  }

  const results: Array<{
    scope: "account" | "user";
    id: string;
    targets: number;
    new_posts: number;
    archived: number;
    briefing_id: string | null;
    errors: string[];
  }> = [];

  // ── Pass 1: account-scoped (v1) ──────────────────────────────────────────
  for (const [accountId, list] of byAccount) {
    let newPosts = 0;
    let archived = 0;
    const errors: string[] = [];
    for (const t of list) {
      try {
        const r = await syncTargetForAccount(admin, t as AccountTarget, accountId);
        newPosts += r.new_posts;
        archived += r.archived;
        if (r.error) errors.push(`${t.label}: ${r.error}`);
      } catch (e) {
        errors.push(`${t.label}: ${String(e)}`);
      }
    }

    let briefingId: string | null = null;
    try {
      const briefing = await generateBriefingForAccount(admin, accountId);
      briefingId = briefing?.id ?? null;
    } catch (e) {
      errors.push(`briefing: ${String(e)}`);
    }

    results.push({
      scope: "account",
      id: accountId,
      targets: list.length,
      new_posts: newPosts,
      archived,
      briefing_id: briefingId,
      errors,
    });
  }

  // ── Pass 2: legacy user-scoped (sem account_id) ──────────────────────────
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
      scope: "user",
      id: userId,
      targets: list.length,
      new_posts: newPosts,
      archived,
      briefing_id: briefingId,
      errors,
    });
  }

  return NextResponse.json({
    ok: true,
    accountsProcessed: byAccount.size,
    usersProcessed: byUser.size,
    results,
  });
}
