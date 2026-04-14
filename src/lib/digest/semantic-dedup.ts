import { getAnthropicClient } from "@/lib/anthropic/client";
import type { ProcessedArticle } from "@/types";

/**
 * Use Sonnet to cluster near-duplicate articles (same story, different sources)
 * and keep only the best one from each cluster. Runs on the processed set where
 * we already have summaries, so the model can spot semantic duplicates even when
 * titles differ significantly.
 *
 * "Best" = highest relevance_score within the cluster.
 * Skips entirely if articles.length <= 5 (not worth the call).
 */
export async function semanticDedup(articles: ProcessedArticle[]): Promise<ProcessedArticle[]> {
  if (articles.length <= 5) return articles;

  const client = getAnthropicClient();

  const list = articles.map((a, i) =>
    `[${i}] ${a.title}\n    ${a.summary.slice(0, 180)}`
  ).join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: `You are a news editor grouping near-duplicate stories.

Two articles are DUPLICATES if they cover the same specific event/story — not just the same topic. Examples:
- "Fed holds rates steady" and "Federal Reserve keeps benchmark rate unchanged" → duplicates (same event)
- "Fed holds rates steady" and "Fed hints at rate cut in Q2" → NOT duplicates (different angles)
- Two articles about the same quarterly earnings release → duplicates
- Article about earnings + article about company's new product → NOT duplicates

Return ONLY a JSON array of index groups. Each group is an array of article indices that are duplicates.
Articles that are unique (no duplicate) do NOT need to appear in the output.

Example output: [[0, 3, 7], [2, 5]]
(means articles 0/3/7 are one story, 2/5 are another, all others are unique)

No markdown, no explanation.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: `Group duplicate stories:\n\n${list}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const groups: number[][] = JSON.parse(jsonText);

    // Build set of indices to drop — keep the one with highest relevance_score per group
    const toDrop = new Set<number>();
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;
      const valid = group.filter((i) => typeof i === "number" && i >= 0 && i < articles.length);
      if (valid.length < 2) continue;
      const best = valid.reduce((best, i) =>
        articles[i].relevance_score > articles[best].relevance_score ? i : best
      );
      for (const i of valid) {
        if (i !== best) toDrop.add(i);
      }
    }

    if (toDrop.size === 0) return articles;

    const deduped = articles.filter((_, i) => !toDrop.has(i));
    console.log(`Semantic dedup: ${articles.length} → ${deduped.length} (dropped ${toDrop.size})`);
    return deduped;
  } catch (err) {
    console.error("Semantic dedup failed, returning original:", err);
    return articles;
  }
}
