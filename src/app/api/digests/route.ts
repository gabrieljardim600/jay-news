import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");
  const digestConfigId = searchParams.get("digestConfigId");

  let query = supabase
    .from("digests")
    .select("id, generated_at, type, status, summary, digest_config_id, metadata")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (digestConfigId) {
    query = query.eq("digest_config_id", digestConfigId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=120" },
  });
}
