import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("social_brand_targets")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { platform, identifier, label, brand_key, niche, mode } = body ?? {};

  if (!platform || !identifier || !label) {
    return NextResponse.json({ error: "platform, identifier, label são obrigatórios" }, { status: 400 });
  }
  if (!["instagram", "facebook_page", "meta_ads", "tiktok"].includes(platform)) {
    return NextResponse.json({ error: "platform inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("social_brand_targets")
    .upsert(
      {
        user_id: user.id,
        platform,
        identifier: String(identifier).trim().replace(/^@/, ""),
        label: String(label).trim(),
        brand_key: brand_key ? String(brand_key).trim() : null,
        niche: niche ? String(niche).trim() : null,
        mode: mode === "news_only" ? "news_only" : "archive_posts",
        is_active: true,
      },
      { onConflict: "user_id,platform,identifier" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...rest } = body ?? {};
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  for (const k of ["label", "brand_key", "niche", "mode", "is_active"] as const) {
    if (k in rest) allowed[k] = rest[k];
  }

  const { data, error } = await supabase
    .from("social_brand_targets")
    .update(allowed)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("social_brand_targets")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
