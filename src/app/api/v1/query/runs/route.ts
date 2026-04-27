import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);

  const supabase = accountClient(ctx);
  let q = supabase
    .from("query_runs")
    .select("id, kind, entity_name, entity, profile_slug, profile_label, module_ids, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  q = byAccount(q, ctx);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
