import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { TrendItem } from "@/types";

const anthropic = new Anthropic();

export async function computeTrends(
  digestConfigId: string,
  currentDigestId: string,
  supabase: SupabaseClient
): Promise<TrendItem[]> {
  try {
    const { data: recentDigests } = await supabase
      .from("digests")
      .select("id, generated_at")
      .eq("digest_config_id", digestConfigId)
      .eq("status", "completed")
      .neq("id", currentDigestId)
      .order("generated_at", { ascending: false })
      .limit(7);

    if (!recentDigests || recentDigests.length < 2) return [];

    const digestIds = recentDigests.map((d) => d.id as string);
    const { data: articles } = await supabase
      .from("articles")
      .select("digest_id, title")
      .in("digest_id", digestIds);

    if (!articles || articles.length < 5) return [];

    const dateByDigest = new Map(
      recentDigests.map((d) => [
        d.id as string,
        (d.generated_at as string).slice(0, 10),
      ])
    );

    const byDate: Record<string, string[]> = {};
    for (const article of articles) {
      const date = dateByDigest.get(article.digest_id as string) ?? "unknown";
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(article.title as string);
    }

    const articlesByDay = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, titles]) => `[${date}]: ${titles.join(" | ")}`)
      .join("\n");

    const prompt = `Here are news articles from recent daily digests, grouped by day.
Identify 2–4 ongoing stories or recurring themes that appear across multiple days.
Each theme should represent a distinct ongoing news event (not a broad topic like "technology" or "economy").

Articles by day:
${articlesByDay}

Return ONLY a JSON array (no explanation):
[{"title":"...","description":"...","days_active":N,"article_count":N}]
"title": short name for the story (max 6 words, in the same language as the articles)
"description": one sentence explaining what is happening (same language as articles)
"days_active": how many days this story appeared
"article_count": approximate total articles about this story across all days

If no recurring stories are found, return [].`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const trends = JSON.parse(jsonMatch[0]) as TrendItem[];
    return trends.slice(0, 4);
  } catch {
    return [];
  }
}
