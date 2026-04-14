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

// ─── Trends search angle generation ─────────────────────────────────────────

export function buildTrendsSearchAnglesMessage(topic: string, keywords: string[], language: string): string {
  const isPt = language === "pt-BR";
  const lang = isPt ? "Brazilian Portuguese" : "English";
  const kw = keywords.length > 0 ? `\nAdditional keywords / entities: ${keywords.join(", ")}` : "";
  const geoSuffix = isPt ? " Brasil" : "";

  return `Generate 7 highly-targeted Tavily web search queries to thoroughly cover the topic: "${topic}"${kw}

CRITICAL RULES:
- ALL queries must be in ${lang}. No mixing languages.
- Every query MUST include the core proper noun(s) from the topic VERBATIM (do not translate or paraphrase names like "Vorcaro", "Banco Master", "Petrobras", etc.).
- ${isPt ? "Add geographic/regional qualifiers where helpful (e.g. Brasil, mercado brasileiro, BCB) to avoid generic global results." : "Stay focused on the specific entity or event — not generic industry terms."}
- Each query should be specific and entity-grounded — avoid vague industry terms like "banking news" alone.
- Distinct angles, not rephrasings. Cover:
  * Latest news / breaking developments
  * Investigation / regulatory angle (if applicable)
  * Market / financial impact
  * Key actors / people involved
  * Official statements / institutional reactions
  * Timeline / background
  * Future outlook / consequences

Topic verbatim: "${topic}"${geoSuffix}

Return ONLY a JSON array of strings (no explanation, no markdown):
["query 1", "query 2", "query 3", "query 4", "query 5", "query 6", "query 7"]`;
}

// ─── Trends briefing (specialized day summary for trends mode) ───────────────

export function buildTrendsBriefingSystemPrompt(): string {
  return `You are a research analyst writing a comprehensive intelligence briefing on a specific topic.

Your briefing must cover, in flowing prose:
1. **Current state** — where things stand right now on this topic
2. **Key developments** — the most significant recent moves, events, or announcements
3. **Expert perspectives** — what analysts, insiders, or observers are saying
4. **Data & signals** — relevant numbers, statistics, or market signals found in the articles
5. **What to watch** — the 2–3 most important things to follow in the coming days/weeks

RULES:
- Write in the requested language
- 4–6 sentences of dense, substantive prose — no filler
- No bullet points, no headers, no markdown — pure prose
- Ground every claim in the articles provided — no invented facts
- Authoritative, precise tone`;
}

export function buildTrendsBriefingUserMessage(summaries: string[], topic: string, language: string): string {
  return `Topic: "${topic}"
Language: ${language}

Article summaries from multiple angles:
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

// ─── Recurring trends detection ──────────────────────────────────────────────

export function buildTrendsDetectionSystemPrompt(): string {
  return `You are a news analyst identifying recurring stories across daily news digests.

Your job is to find 2–4 ongoing stories or themes that appear across multiple days — NOT broad topics like "technology" or "economy", but specific unfolding events like "Fed rate decision uncertainty" or "OpenAI leadership changes".

For each recurring story:
- "title": 5–7 word name (in the same language as the articles)
- "description": one sharp sentence explaining what is actually happening (not just what the topic is)
- "days_active": how many days this story appeared
- "article_count": approximate total articles about this story

RULES:
- Prefer stories with clear narrative continuity over broad thematic overlap
- If genuinely no recurring stories exist, return []
- OUTPUT: valid JSON array only, no explanation, no markdown fences`;
}

export function buildTrendsDetectionUserMessage(articlesByDay: Record<string, { title: string; summary: string }[]>): string {
  const lines = Object.entries(articlesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, articles]) => {
      const items = articles.map((a) => `  • ${a.title}: ${a.summary}`).join("\n");
      return `[${date}]\n${items}`;
    })
    .join("\n\n");

  return `Articles from recent digests, grouped by day:\n\n${lines}`;
}
