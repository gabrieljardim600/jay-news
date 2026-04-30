import {
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import {
  syncAllForAccount,
  syncTargetForAccount,
  type AccountTarget,
} from "@/lib/social-brand/collector-v1";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");

  let targetId: string | null = null;
  try {
    const body = await req.json();
    targetId = body?.target_id ?? null;
  } catch {
    // sem body — sincroniza tudo
  }

  const supabase = accountClient(ctx);

  if (targetId) {
    let q = supabase.from("social_brand_targets").select("*").eq("id", targetId);
    q = byAccount(q, ctx);
    const { data: target } = await q.single();
    if (!target) {
      return NextResponse.json({ error: { message: "Target não encontrado" } }, { status: 404 });
    }
    const report = await syncTargetForAccount(supabase, target as AccountTarget, ctx.account_id);
    return NextResponse.json({ data: { reports: [report] } });
  }

  const reports = await syncAllForAccount(supabase, ctx.account_id);
  return NextResponse.json({ data: { reports } });
});
