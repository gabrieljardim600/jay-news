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

  const results: Array<{
    user_id: string;
    inserted: number;
    dossiers: number;
    errors: string[];
  }> = [];

  for (const uid of userIds) {
    try {
      const report = await collectGossipForUser(admin, uid);
      const dossiers = await generateDossiersForUser(admin, uid);
      results.push({
        user_id: uid,
        inserted: report.inserted,
        dossiers: dossiers.length,
        errors: report.errors,
      });
    } catch (err) {
      results.push({
        user_id: uid,
        inserted: 0,
        dossiers: 0,
        errors: [String(err)],
      });
    }
  }

  return NextResponse.json({ ok: true, usersProcessed: results.length, results });
}
