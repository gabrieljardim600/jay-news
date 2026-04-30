import {
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { generateBriefingForAccount } from "@/lib/social-brand/briefing-v1";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export const GET = withService(async (_req, ctx) => {
  const supabase = accountClient(ctx);
  let q = supabase
    .from("social_brand_briefings")
    .select("id, date, generated_at, summary, highlights, posts_count, ads_count, targets_count")
    .order("date", { ascending: false })
    .limit(30);
  q = byAccount(q, ctx);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (_req, ctx) => {
  requireRole(ctx, "editor");
  const supabase = accountClient(ctx);
  const result = await generateBriefingForAccount(supabase, ctx.account_id);
  if (!result) {
    return NextResponse.json({ data: null, message: "Sem posts novos para gerar briefing" });
  }
  return NextResponse.json({ data: result });
});
