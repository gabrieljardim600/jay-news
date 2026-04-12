import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { DigestWithArticles, Article } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .select("*")
    .eq("id", id)
    .single();

  if (digestError || !digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("*")
    .eq("digest_id", id)
    .order("relevance_score", { ascending: false });

  if (articlesError) {
    return NextResponse.json(
      { error: articlesError.message },
      { status: 500 }
    );
  }

  const highlights = (articles || []).filter((a: Article) => a.is_highlight);
  const byTopic: Record<string, Article[]> = {};
  const alertArticles: Article[] = [];

  for (const article of articles || []) {
    if (article.alert_id) {
      alertArticles.push(article);
    }
    const key = article.topic_id || "uncategorized";
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(article);
  }

  const result: DigestWithArticles = {
    ...digest,
    articles: articles || [],
    highlights,
    by_topic: byTopic,
    alert_articles: alertArticles,
  };

  return NextResponse.json(result);
}
