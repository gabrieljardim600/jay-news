import type { RawArticle, Topic } from "@/types";

export function buildBatchPrompt(articles: RawArticle[], topics: Topic[], language: string, style: string): string {
  const topicList = topics.map((t) => `- "${t.name}" (id: ${t.id}, priority: ${t.priority}, keywords: ${t.keywords.join(", ")})`).join("\n");
  const articleList = articles.map((a, i) => `[${i}] Title: ${a.title}\nSource: ${a.source_name}\nURL: ${a.url}\nContent: ${a.content.slice(0, 500)}`).join("\n\n");
  const styleInstruction = style === "executive"
    ? "Write concise 2-3 sentence summaries focused on key facts and implications."
    : "Write detailed 4-5 sentence summaries covering context, details, and analysis.";

  return `You are a news analyst. Process these articles and return a JSON array.

Language: ${language}
Style: ${styleInstruction}

Available topics:
${topicList}

Articles to process:
${articleList}

For each article, return a JSON object with:
- "index": the article index number [N]
- "summary": summary in ${language}
- "topic_id": the best matching topic ID from the list above, or null if none match
- "relevance_score": float 0.0-1.0 based on how relevant and important this article is. Consider topic priority (high priority topics get a boost).

Return ONLY a valid JSON array, no markdown, no explanation.`;
}

export function buildDaySummaryPrompt(summaries: string[], language: string): string {
  return `You are a news editor. Based on these article summaries from today, write a 2-3 sentence overview of the day's most important news themes. Write in ${language}. Be concise and insightful.

Today's articles:
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Return ONLY the summary text, no quotes, no labels.`;
}
