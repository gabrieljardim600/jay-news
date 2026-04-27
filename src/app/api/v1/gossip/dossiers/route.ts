import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const topicId = url.searchParams.get("topic_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);

  const supabase = accountClient(ctx);
  let q = supabase
    .from("gossip_dossiers")
    .select("id, topic_id, date, summary, key_quotes, spike_score, spike_level, post_ids, created_at")
    .order("date", { ascending: false })
    .limit(limit);
  q = byAccount(q, ctx);
  if (topicId) q = q.eq("topic_id", topicId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
