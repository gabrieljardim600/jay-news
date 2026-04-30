import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const targetId = url.searchParams.get("target_id");
  const platform = url.searchParams.get("platform");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const supabase = accountClient(ctx);
  let q = supabase
    .from("social_brand_posts")
    .select(
      "id,target_id,external_id,kind,platform,caption,permalink,posted_at,media,archive,metrics,fetched_at,social_brand_targets!inner(label,profile)",
    )
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  q = byAccount(q, ctx);
  if (targetId) q = q.eq("target_id", targetId);
  if (platform) q = q.eq("platform", platform);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
