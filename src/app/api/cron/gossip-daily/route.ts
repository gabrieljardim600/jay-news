import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectGossipForUser } from "@/lib/gossip/collector";
import { generateDossiersForUser } from "@/lib/gossip/dossier";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: userRows } = await admin
    .from("gossip_sources")
    .select("user_id")
    .eq("active", true);
  const userIds = Array.from(new Set((userRows ?? []).map((r) => r.user_id as string)));

  // Resolve default_account_id por user (multi-tenant). null = legacy / sem account.
  const accountByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, default_account_id")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      accountByUser.set(p.user_id as string, (p.default_account_id as string | null) ?? null);
    }
  }

  const results: Array<{
    user_id: string;
    account_id: string | null;
    inserted: number;
    dossiers: number;
    errors: string[];
  }> = [];

  for (const uid of userIds) {
    const accountId = accountByUser.get(uid) ?? null;
    try {
      const report = await collectGossipForUser(admin, uid, accountId);
      const dossiers = await generateDossiersForUser(admin, uid, accountId);
      results.push({
        user_id: uid,
        account_id: accountId,
        inserted: report.inserted,
        dossiers: dossiers.length,
        errors: report.errors,
      });
    } catch (err) {
      results.push({
        user_id: uid,
        account_id: accountId,
        inserted: 0,
        dossiers: 0,
        errors: [String(err)],
      });
    }
  }

  return NextResponse.json({ ok: true, usersProcessed: results.length, results });
}
