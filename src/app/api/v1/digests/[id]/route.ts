import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let dq = supabase
    .from("digests")
    .select("id, generated_at, type, status, summary, digest_config_id, metadata")
    .eq("id", id);
  dq = byAccount(dq, ctx);
  const { data: digest, error: dErr } = await dq.maybeSingle();

  if (dErr) return NextResponse.json({ error: { message: dErr.message } }, { status: 500 });
  if (!digest) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  type Article = {
    id: string;
    topic_id: string | null;
    alert_id: string | null;
    title: string;
    source_name: string | null;
    source_url: string | null;
    summary: string | null;
    key_quote: string | null;
    relevance_score: number | null;
    is_highlight: boolean | null;
    image_url: string | null;
    published_at: string | null;
    full_content: string | null;
  };

  const { data: articles, error: aErr } = await supabase
    .from("articles")
    .select(
      "id, topic_id, alert_id, title, source_name, source_url, summary, key_quote, relevance_score, is_highlight, image_url, published_at, full_content"
    )
    .eq("digest_id", id)
    .order("relevance_score", { ascending: false, nullsFirst: false });

  if (aErr) return NextResponse.json({ error: { message: aErr.message } }, { status: 500 });

  const items = (articles ?? []) as Article[];
  const highlights = items.filter((a) => a.is_highlight);
  const alertArticles = items.filter((a) => a.alert_id);
  const grouped: Record<string, Article[]> = {};
  for (const a of items) {
    const key = a.topic_id || "untagged";
    (grouped[key] ||= []).push(a);
  }

  return NextResponse.json({
    data: {
      digest,
      articles: items,
      highlights,
      alert_articles: alertArticles,
      by_topic: grouped,
    },
  });
});
