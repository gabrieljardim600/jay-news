import { getAnthropicClient } from "@/lib/anthropic/client";
import {
  buildBatchSystemPrompt,
  buildBatchUserMessage,
  buildDaySummarySystemPrompt,
  buildDaySummaryUserMessage,
  buildHighlightsSystemPrompt,
  buildHighlightsUserMessage,
  buildTrendsSearchAnglesMessage,
  buildTrendsBriefingSystemPrompt,
  buildTrendsBriefingUserMessage,
} from "@/lib/anthropic/prompts";
import type { RawArticle, RssSource, Topic, ProcessedArticle } from "@/types";

type SearchAngle = { query: string; maxResults: number; searchDepth: "basic" | "advanced" };

const BATCH_SIZE = 10;
const MAX_PARALLEL_BATCHES = 3;

interface BatchResult {
  index: number;
  summary: string;
  key_quote: string | null;
  topic_id: string | null;
  relevance_score: number;
}

async function processBatch(
  articles: RawArticle[],
  topics: Topic[],
  language: string,
  style: string
): Promise<BatchResult[]> {
  const client = getAnthropicClient();

  const maxTokens = style === "complete" ? 12000 : 6000;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: buildBatchSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildBatchUserMessage(articles, topics, language, style) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // fall through
      }
    }
    console.error("Failed to parse batch response:", text.slice(0, 500));
    return [];
  }
}

async function selectHighlights(articles: ProcessedArticle[]): Promise<number[]> {
  if (articles.length <= 3) return articles.map((_, i) => i);

  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 64,
      system: [
        {
          type: "text",
          text: buildHighlightsSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildHighlightsUserMessage(articles) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const indices: number[] = JSON.parse(jsonText);

    // Validate all indices are in range
    const valid = indices.filter((i) => typeof i === "number" && i >= 0 && i < articles.length);
    if (valid.length === 3) return valid;
  } catch (err) {
    console.error("Highlight selection failed, falling back to top-3 by score:", err);
  }

  // Fallback: top 3 by relevance score
  return [...articles.keys()]
    .sort((a, b) => articles[b].relevance_score - articles[a].relevance_score)
    .slice(0, 3);
}

export async function processArticles(
  rawArticles: RawArticle[],
  topics: Topic[],
  language: string,
  style: string,
  sources?: RssSource[]
): Promise<ProcessedArticle[]> {
  const processed: ProcessedArticle[] = [];

  const batches: RawArticle[][] = [];
  for (let i = 0; i < rawArticles.length; i += BATCH_SIZE) {
    batches.push(rawArticles.slice(i, i + BATCH_SIZE));
  }

  // Run batches in parallel with bounded concurrency
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const chunk = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    const chunkResults = await Promise.all(
      chunk.map(async (batch) => {
        try {
          return { batch, results: await processBatch(batch, topics, language, style) };
        } catch (error) {
          console.error("Batch failed, retrying:", error);
          try {
            return { batch, results: await processBatch(batch, topics, language, style) };
          } catch {
            console.error("Batch retry failed, skipping batch");
            return { batch, results: [] as BatchResult[] };
          }
        }
      })
    );

    for (const { batch, results } of chunkResults) {
      for (const result of results) {
        const raw = batch[result.index];
        if (!raw) continue;
        processed.push({
          title: raw.title,
          source_name: raw.source_name,
          source_url: raw.url,
          summary: result.summary,
          key_quote: result.key_quote || null,
          full_content: raw.full_content || null,
          topic_id: result.topic_id,
          alert_id: null,
          relevance_score: result.relevance_score,
          is_highlight: false,
          image_url: raw.image_url || null,
          published_at: raw.published_at || null,
        });
      }
    }
  }

  // Apply source weight boost, then re-sort
  if (sources && sources.length > 0) {
    const sourceByName = Object.fromEntries(sources.map((s) => [s.name, s]));
    for (const article of processed) {
      const source = sourceByName[article.source_name];
      if (source) {
        article.relevance_score = Math.min(1.0, article.relevance_score * (1 + (source.weight - 3) * 0.1));
      }
    }
  }

  processed.sort((a, b) => b.relevance_score - a.relevance_score);

  // Use Opus to select highlights with editorial judgment
  const highlightIndices = await selectHighlights(processed);
  for (const idx of highlightIndices) {
    processed[idx].is_highlight = true;
  }

  return processed;
}

export async function generateDaySummary(summaries: string[], language: string): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: buildDaySummarySystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildDaySummaryUserMessage(summaries, language) }],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : "";
}

export async function generateTrendsSearchAngles(
  topic: string,
  keywords: string[],
  language: string
): Promise<SearchAngle[]> {
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: buildTrendsSearchAnglesMessage(topic, keywords, language) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const queries: string[] = JSON.parse(jsonText);

    return queries.map((query, i) => ({
      query,
      maxResults: i < 3 ? 8 : 5,
      searchDepth: i < 4 ? ("advanced" as const) : ("basic" as const),
    }));
  } catch (err) {
    console.error("Failed to generate search angles, using fallback:", err);
    // Fallback to hardcoded angles
    const extra = keywords.join(" ");
    const lang = language === "pt-BR" ? "PT" : "EN";
    return [
      { query: `${topic} ${extra} últimas notícias`.trim(), maxResults: 8, searchDepth: "advanced" },
      { query: `${topic} análise tendências`, maxResults: 6, searchDepth: "advanced" },
      { query: `${topic} impacto novidades`, maxResults: 6, searchDepth: "advanced" },
      { query: `${topic} especialistas perspectivas`, maxResults: 5, searchDepth: "advanced" },
      { query: `${topic} dados estatísticas relatório`, maxResults: 5, searchDepth: "basic" },
      ...(lang === "PT" ? [{ query: `${topic} latest news ${extra}`.trim(), maxResults: 6, searchDepth: "advanced" as const }] : []),
    ];
  }
}

export async function generateTrendsBriefing(
  summaries: string[],
  topic: string,
  language: string
): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: buildTrendsBriefingSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildTrendsBriefingUserMessage(summaries, topic, language) }],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : "";
}
