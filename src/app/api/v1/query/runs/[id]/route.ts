import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("query_runs")
    .select("id, kind, entity_name, entity, profile_id, profile_slug, profile_label, module_ids, result, duration_ms, created_at")
    .eq("id", id);
  q = byAccount(q, ctx);

  const { data, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ data });
});
