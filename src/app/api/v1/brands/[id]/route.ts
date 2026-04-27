import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let sq = supabase
    .from("brand_scrapes")
    .select(
      "id, root_url, domain, status, intent, engine, title, description, favicon_url, urls_scraped, total_assets, total_colors, design_system, error, started_at, finished_at, created_at"
    )
    .eq("id", id);
  sq = byAccount(sq, ctx);
  const { data: scrape, error } = await sq.maybeSingle();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!scrape) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  const { data: assets } = await supabase
    .from("brand_assets")
    .select("id, type, role, original_url, public_url, file_size_kb, mime_type, width, height, metadata")
    .eq("scrape_id", id)
    .order("type", { ascending: true });

  return NextResponse.json({ data: { ...scrape, assets: assets || [] } });
});

export const DELETE = withService<unknown, Params>(async (_req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const supabase = accountClient(ctx);
  let q = supabase.from("brand_scrapes").delete().eq("id", id);
  q = byAccount(q, ctx);
  const { error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
