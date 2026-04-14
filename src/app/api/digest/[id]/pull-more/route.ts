import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enrichArticles } from "@/lib/sources/enrich";
import { cleanArticlesContent } from "@/lib/sources/content-cleaner";
import { processArticles } from "@/lib/digest/processor";
import { filterArticles } from "@/lib/digest/filter";
import { NextResponse } from "next/server";
import type { RawArticle, RssSource, Topic, Exclusion } from "@/types";

export const maxDuration = 180;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: digestId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sourceName = body.source as string | undefined;
  if (!sourceName) return NextResponse.json({ error: "Missing source" }, { status: 400 });

  // Load digest to get config
  const { data: digest } = await supabase
    .from("digests")
    .select("id, digest_config_id")
    .eq("id", digestId)
    .eq("user_id", user.id)
    .single();
  if (!digest) return NextResponse.json({ error: "Digest not found" }, { status: 404 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const configId = digest.digest_config_id as string | null;
  if (!configId) return NextResponse.json({ error: "Digest has no config" }, { status: 400 });

  // Load config, source, topics, exclusions
  const [{ data: config }, { data: sources }, { data: topics }, { data: exclusions }, { data: existingArticles }] = await Promise.all([
    service.from("digest_configs").select("language, summary_style").eq("id", configId).single(),
    service.from("rss_sources").select("*").eq("digest_config_id", configId).eq("is_active", true),
    service.from("topics").select("*").eq("digest_config_id", configId).eq("is_active", true),
    service.from("exclusions").select("*").eq("digest_config_id", configId).eq("is_active", true),
    service.from("articles").select("source_url").eq("digest_id", digestId),
  ]);

  if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });

  const allSources: RssSource[] = sources || [];
  const allTopics: Topic[] = topics || [];
  const allExclusions: Exclusion[] = exclusions || [];

  // Find the source by name
  const source = allSources.find((s) => s.name === sourceName);

  const existingUrls = new Set((existingArticles || []).map((a) => (a.source_url as string).toLowerCase().replace(/\/+$/, "")));

  // Fetch fresh articles from this source
  let newRaw: RawArticle[] = [];

  if (source) {
    if (source.source_type === "web") {
      const domain = source.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const linkedTopic = allTopics.find((t) => t.id === source.topic_id);
      const keywords = linkedTopic ? linkedTopic.keywords.slice(0, 3).join(" ") : source.name;
      const lang = config.language === "pt-BR" ? "noticias" : "news";
      const { searchAllTopics } = await import("@/lib/sources/search");
      newRaw = await searchAllTopics([
        { query: `${keywords} ${lang}`, maxResults: 10, includeDomains: [domain], searchDepth: "advanced" },
      ]);
    } else {
      const { fetchRssFeed } = await import("@/lib/sources/rss");
      newRaw = await fetchRssFeed(source.url, source.name);
    }
  } else {
    // Source not in config — treat sourceName as a domain and use Tavily
    const { searchAllTopics } = await import("@/lib/sources/search");
    newRaw = await searchAllTopics([
      { query: `${sourceName} noticias`, maxResults: 10, includeDomains: [sourceName], searchDepth: "advanced" },
    ]);
  }

  // Dedup against articles already in this digest
  newRaw = newRaw.filter((a) => {
    const normalized = a.url.toLowerCase().replace(/\/+$/, "");
    return !existingUrls.has(normalized);
  });

  newRaw = filterArticles(newRaw, allExclusions).slice(0, 15);

  if (newRaw.length === 0) {
    return NextResponse.json({ added: 0, message: "No new articles found" });
  }

  // Enrich + clean + process
  const enrichedRaw = await enrichArticles(newRaw);
  const enriched = enrichedRaw.filter((a) => (a.full_content || a.content || "").length >= 500);
  if (enriched.length === 0) return NextResponse.json({ added: 0, message: "No substantive content" });

  const cleaned = await cleanArticlesContent(enriched);
  const processed = await processArticles(cleaned, allTopics, config.language, config.summary_style, allSources);
  const publishable = processed.filter((a) => a.relevance_score > 0);
  if (publishable.length === 0) return NextResponse.json({ added: 0, message: "No relevant articles" });

  const topicIds = new Set(allTopics.map((t) => t.id));
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeTopicId = (tid: string | null) =>
    tid && UUID_RE.test(tid) && topicIds.has(tid) ? tid : null;

  const rows = publishable.map((a) => ({
    digest_id: digestId,
    topic_id: safeTopicId(a.topic_id),
    alert_id: null,
    title: a.title,
    source_name: a.source_name,
    source_url: a.source_url,
    summary: a.summary,
    key_quote: a.key_quote,
    full_content: a.full_content,
    relevance_score: a.relevance_score,
    is_highlight: false,
    image_url: a.image_url,
    published_at: a.published_at,
  }));

  const { error } = await service.from("articles").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: rows.length });
}
