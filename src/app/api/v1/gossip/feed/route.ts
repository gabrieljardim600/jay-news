import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const since = url.searchParams.get("since");
  const sourceId = url.searchParams.get("source_id");
  const topicId = url.searchParams.get("topic_id");

  const supabase = accountClient(ctx);

  // If topic filter, join via gossip_post_topics
  if (topicId) {
    const { data: links, error: linkErr } = await supabase
      .from("gossip_post_topics")
      .select("post_id")
      .eq("topic_id", topicId)
      .limit(limit);
    if (linkErr) return NextResponse.json({ error: { message: linkErr.message } }, { status: 500 });
    const ids = (links || []).map((l: { post_id: string }) => l.post_id);
    if (ids.length === 0) return NextResponse.json({ data: [] });

    let q = supabase
      .from("gossip_posts")
      .select("id, source_id, platform, url, author, title, body, image_url, published_at")
      .in("id", ids)
      .order("published_at", { ascending: false })
      .limit(limit);
    q = byAccount(q, ctx);
    if (since) q = q.gte("published_at", since);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  let q = supabase
    .from("gossip_posts")
    .select("id, source_id, platform, url, author, title, body, image_url, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  q = byAccount(q, ctx);
  if (since) q = q.gte("published_at", since);
  if (sourceId) q = q.eq("source_id", sourceId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
