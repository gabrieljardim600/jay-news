import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("target_id");
  const platform = searchParams.get("platform");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  let q = supabase
    .from("social_brand_posts")
    .select("id,target_id,external_id,kind,platform,caption,permalink,posted_at,media,archive,metrics,fetched_at,social_brand_targets!inner(label,profile)")
    .eq("user_id", user.id)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (targetId) q = q.eq("target_id", targetId);
  if (platform) q = q.eq("platform", platform);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
