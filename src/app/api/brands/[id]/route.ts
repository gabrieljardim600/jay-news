import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: scrape, error: scrapeErr } = await supabase
    .from("brand_scrapes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (scrapeErr) return NextResponse.json({ error: scrapeErr.message }, { status: 500 });
  if (!scrape) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: assets, error: assetsErr } = await supabase
    .from("brand_assets")
    .select("*")
    .eq("scrape_id", id)
    .order("type", { ascending: true });

  if (assetsErr) return NextResponse.json({ error: assetsErr.message }, { status: 500 });

  let htmlPreviewUrl: string | null = null;
  if (scrape.html_preview_path) {
    const { data: urlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(scrape.html_preview_path);
    htmlPreviewUrl = urlData.publicUrl;
  }

  return NextResponse.json({ scrape, assets, htmlPreviewUrl });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: assets } = await supabase
    .from("brand_assets")
    .select("storage_path")
    .eq("scrape_id", id);

  const { data: scrape } = await supabase
    .from("brand_scrapes")
    .select("html_preview_path, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!scrape || scrape.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const paths = [
    ...(assets?.map((a) => a.storage_path) ?? []),
    ...(scrape.html_preview_path ? [scrape.html_preview_path] : []),
  ];
  if (paths.length > 0) {
    await supabase.storage.from("brand-assets").remove(paths);
  }

  const { error } = await supabase.from("brand_scrapes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
