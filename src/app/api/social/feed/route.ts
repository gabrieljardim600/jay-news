import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "voices" | "crowd" | null = both
  const limit = Math.min(Number(searchParams.get("limit") || "60"), 200);

  let query = supabase
    .from("social_posts")
    .select("*")
    .eq("user_id", user.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (type === "voices") query = query.not("voice_id", "is", null);
  else if (type === "crowd") query = query.not("crowd_source_id", "is", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
