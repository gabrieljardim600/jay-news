// GET /api/cron/social-collect
//
// Cron handler — coleta voices/crowd a cada 2h. Pega todos os accounts +
// users com voices/crowd ativos e roda os respectivos coletores.
//
// Auth: Bearer ${CRON_SECRET} (Vercel cron envia automaticamente).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectForAccount, collectForUser } from "@/lib/social/collector";

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

  // Lista voices + crowd ativos pra descobrir os scopes (account vs user-only)
  const [voicesRes, crowdRes] = await Promise.all([
    admin.from("social_voices").select("user_id, account_id").eq("is_active", true),
    admin.from("crowd_sources").select("user_id, account_id").eq("is_active", true),
  ]);

  const accounts = new Set<string>();
  const userOnly = new Set<string>();

  for (const row of [...(voicesRes.data ?? []), ...(crowdRes.data ?? [])]) {
    if (row.account_id) {
      accounts.add(row.account_id);
    } else if (row.user_id) {
      userOnly.add(row.user_id);
    }
  }

  type Report = Awaited<ReturnType<typeof collectForAccount>>["reports"][number];
  const results: Array<{
    scope: "account" | "user";
    id: string;
    voices: number;
    crowd: number;
    posts_upserted: number;
    errors: string[];
    reports: Report[];
  }> = [];

  // Pass 1: account-scoped
  for (const accountId of accounts) {
    try {
      const r = await collectForAccount(admin, accountId);
      results.push({
        scope: "account",
        id: accountId,
        voices: r.voicesProcessed,
        crowd: r.crowdProcessed,
        posts_upserted: r.postsUpserted,
        errors: r.errors,
        reports: r.reports,
      });
    } catch (e) {
      results.push({
        scope: "account",
        id: accountId,
        voices: 0,
        crowd: 0,
        posts_upserted: 0,
        errors: [String(e)],
        reports: [],
      });
    }
  }

  // Pass 2: legacy user-only (sem account_id)
  for (const userId of userOnly) {
    try {
      const r = await collectForUser(admin, userId);
      results.push({
        scope: "user",
        id: userId,
        voices: r.voicesProcessed,
        crowd: r.crowdProcessed,
        posts_upserted: r.postsUpserted,
        errors: r.errors,
        reports: r.reports,
      });
    } catch (e) {
      results.push({
        scope: "user",
        id: userId,
        voices: 0,
        crowd: 0,
        posts_upserted: 0,
        errors: [String(e)],
        reports: [],
      });
    }
  }

  const totalUpserted = results.reduce((acc, r) => acc + r.posts_upserted, 0);

  return NextResponse.json({
    ok: true,
    accounts_processed: accounts.size,
    users_processed: userOnly.size,
    total_posts_upserted: totalUpserted,
    results,
  });
}
