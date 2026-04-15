import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { enrichArticles } from "@/lib/sources/enrich";
import type { RawArticle } from "@/types";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function service() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership: article must belong to a market owned by the user (RLS enforces).
  const { data: row } = await supabase
    .from("market_articles")
    .select("id, title, source_url, source_name, summary, full_content, image_url, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.full_content && row.full_content.length >= 200) {
    return NextResponse.json({ full_content: row.full_content, image_url: row.image_url, cached: true });
  }

  const raw: RawArticle = {
    title: row.title,
    url: row.source_url,
    source_name: row.source_name,
    content: row.summary || "",
    full_content: undefined,
    image_url: row.image_url || undefined,
    published_at: row.published_at || undefined,
  };

  try {
    const [enriched] = await enrichArticles([raw]);
    const fullContent = enriched?.full_content || null;
    const imageUrl = enriched?.image_url || row.image_url || null;
    // Persist via service role (bypasses RLS safely since we already validated
    // ownership above via the user-scoped select).
    await service()
      .from("market_articles")
      .update({ full_content: fullContent, image_url: imageUrl })
      .eq("id", id);
    return NextResponse.json({ full_content: fullContent, image_url: imageUrl, cached: false });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed" }, { status: 500 });
  }
}
