import { getAnthropicClient } from "@/lib/anthropic/client";
import { buildBatchPrompt, buildDaySummaryPrompt } from "@/lib/anthropic/prompts";
import type { RawArticle, RssSource, Topic, ProcessedArticle } from "@/types";

const BATCH_SIZE = 10;

interface BatchResult {
  index: number;
  summary: string;
  topic_id: string | null;
  relevance_score: number;
}

async function processBatch(articles: RawArticle[], topics: Topic[], language: string, style: string): Promise<BatchResult[]> {
  const client = getAnthropicClient();
  const prompt = buildBatchPrompt(articles, topics, language, style);

  const maxTokens = style === "complete" ? 8192 : 4096;
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse Claude response:", text.slice(0, 200));
    return [];
  }
}

export async function processArticles(rawArticles: RawArticle[], topics: Topic[], language: string, style: string, sources?: RssSource[]): Promise<ProcessedArticle[]> {
  const processed: ProcessedArticle[] = [];

  for (let i = 0; i < rawArticles.length; i += BATCH_SIZE) {
    const batch = rawArticles.slice(i, i + BATCH_SIZE);

    let results: BatchResult[];
    try {
      results = await processBatch(batch, topics, language, style);
    } catch (error) {
      console.error("Batch failed, retrying:", error);
      try {
        results = await processBatch(batch, topics, language, style);
      } catch {
        console.error("Batch retry failed, skipping batch");
        continue;
      }
    }

    for (const result of results) {
      const raw = batch[result.index];
      if (!raw) continue;

      processed.push({
        title: raw.title,
        source_name: raw.source_name,
        source_url: raw.url,
        summary: result.summary,
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

  // Apply weight boost from source config, then re-sort
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
  for (let i = 0; i < Math.min(3, processed.length); i++) {
    processed[i].is_highlight = true;
  }

  return processed;
}

export async function generateDaySummary(summaries: string[], language: string): Promise<string> {
  const client = getAnthropicClient();
  const prompt = buildDaySummaryPrompt(summaries, language);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
