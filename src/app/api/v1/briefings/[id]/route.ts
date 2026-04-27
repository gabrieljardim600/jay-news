import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("competitor_briefings")
    .select("id, market_id, competitor_id, status, content, resumo, data_quality, model_used, articles_analyzed, error, started_at, finished_at, profile_slug, profile_label")
    .eq("id", id);
  q = byAccount(q, ctx);

  const { data, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  return NextResponse.json({ data });
});
