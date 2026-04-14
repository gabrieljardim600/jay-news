import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { buildTrendsDetectionSystemPrompt, buildTrendsDetectionUserMessage } from "@/lib/anthropic/prompts";
import type { TrendItem } from "@/types";

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
      .select("digest_id, title, summary")
      .in("digest_id", digestIds);

    if (!articles || articles.length < 5) return [];

    const dateByDigest = new Map(
      recentDigests.map((d) => [d.id as string, (d.generated_at as string).slice(0, 10)])
    );

    const byDate: Record<string, { title: string; summary: string }[]> = {};
    for (const article of articles) {
      const date = dateByDigest.get(article.digest_id as string) ?? "unknown";
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        title: article.title as string,
        summary: (article.summary as string | null) ?? "",
      });
    }

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: buildTrendsDetectionSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildTrendsDetectionUserMessage(byDate) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const trends = JSON.parse(jsonMatch[0]) as TrendItem[];
    return trends.slice(0, 4);
  } catch {
    return [];
  }
}
