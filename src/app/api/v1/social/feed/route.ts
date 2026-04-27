import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // 'voices' | 'crowd' | null
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const since = url.searchParams.get("since");

  const supabase = accountClient(ctx);
  let q = supabase
    .from("social_posts")
    .select(
      "id, voice_id, crowd_source_id, platform, author, title, content, source_url, image_url, published_at, fetched_at"
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  q = byAccount(q, ctx);
  if (type === "voices") q = q.not("voice_id", "is", null);
  if (type === "crowd") q = q.not("crowd_source_id", "is", null);
  if (since) q = q.gte("published_at", since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
