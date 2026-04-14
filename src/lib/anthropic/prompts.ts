import type { RawArticle, Topic, ProcessedArticle } from "@/types";

// ─── Batch processing ────────────────────────────────────────────────────────

export function buildBatchSystemPrompt(): string {
  return `You are a senior news analyst. Your job is to process raw news articles and extract structured intelligence.

For each article, produce:
- "index": the article's [N] index
- "summary": editorial summary in the requested language and style
- "key_quote": the single most impactful or revealing sentence from the article (copy verbatim from the source, or null if nothing stands out)
- "topic_id": best matching topic ID from the provided list, or null if none fits
- "relevance_score": float 0.0–1.0 representing newsworthiness and importance

RELEVANCE SCORING GUIDE:
- 0.9–1.0: Major breaking news, market-moving events, policy changes with broad impact, exclusive investigations
- 0.7–0.89: Significant developments, notable executive moves, important earnings, geopolitical events
- 0.5–0.69: Notable but routine: scheduled releases, expected announcements, incremental updates
- 0.3–0.49: Soft news, opinion pieces, minor updates, duplicates of bigger stories
- 0.0–0.29: Press releases, listicles, sponsored content, clearly promotional material

TOPIC MATCHING:
- Match based on keywords AND semantic meaning — not just literal keyword presence
- High-priority topics deserve a small relevance boost (up to +0.05) when scores are otherwise equal

OUTPUT: Return ONLY a valid JSON array. No markdown fences, no explanation.`;
}

export function buildBatchUserMessage(articles: RawArticle[], topics: Topic[], language: string, style: string): string {
  const topicList = topics.map((t) =>
    `- "${t.name}" (id: ${t.id}, priority: ${t.priority}, keywords: ${t.keywords.join(", ")})`
  ).join("\n");

  const styleInstruction = style === "executive"
    ? "2–3 sentence summaries focused on key facts and immediate implications."
    : style === "complete"
      ? "Comprehensive summaries that capture the full story: context, developments, data points, quotes, and analysis. The reader should not need to visit the original. Aim for 8–12 sentences organized as: [Context] → [Key developments] → [Implications/what's next]."
      : "4–5 sentence summaries covering context, core facts, and analysis.";

  const articleList = articles.map((a, i) => {
    const body = (a.full_content || a.content).slice(0, 3000);
    return `[${i}] Title: ${a.title}\nSource: ${a.source_name}\nContent: ${body}`;
  }).join("\n\n---\n\n");

  return `Language: ${language}
Summary style: ${styleInstruction}

Available topics:
${topicList}

Articles:
${articleList}`;
}

// ─── Day summary ─────────────────────────────────────────────────────────────

export function buildDaySummarySystemPrompt(): string {
  return `You are a world-class news editor writing the day's top-line briefing.

Your briefing should:
- Identify the 2–3 most important themes across all articles
- Highlight the single most impactful story of the day
- Note any surprising, counterintuitive, or especially significant developments
- End with one forward-looking sentence about what to watch next

RULES:
- Write in the requested language
- Exactly 3 sentences — no more, no less
- No bullet points, no headers, no markdown — pure prose
- Authoritative, precise tone. No filler phrases like "Today's news covers..."`;
}

export function buildDaySummaryUserMessage(summaries: string[], language: string): string {
  return `Language: ${language}

Today's article summaries:
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

// ─── Highlight selection ─────────────────────────────────────────────────────

export function buildHighlightsSystemPrompt(): string {
  return `You are a senior editor choosing the day's top stories for the front page.

Select exactly 3 articles that best represent the day's most important, interesting, or impactful news.

SELECTION CRITERIA (in priority order):
1. Genuine newsworthiness — affects many people, significant consequences, major shift in a situation
2. Exclusivity or depth — original reporting, exclusive data, or uniquely insightful analysis
3. Diversity — avoid picking 3 articles on the same story; prefer breadth across topics
4. Reader value — something the reader will actually want to know today

AVOID:
- Soft news, opinion pieces, or clearly promotional content as highlights
- Picking multiple near-duplicate articles about the same event
- Boosting articles purely because of their relevance_score if they lack genuine importance

OUTPUT: Return a JSON array of exactly 3 article indices (e.g. [2, 7, 14]). No markdown, no explanation.`;
}

export function buildHighlightsUserMessage(articles: ProcessedArticle[]): string {
  const list = articles.map((a, i) =>
    `[${i}] ${a.title}\nSource: ${a.source_name} | Topic: ${a.topic_id || "none"} | Score: ${a.relevance_score.toFixed(2)}\nSummary: ${a.summary}`
  ).join("\n\n");

  return `Select the 3 most important articles for today's front page:\n\n${list}`;
}
