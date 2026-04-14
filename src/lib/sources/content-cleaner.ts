import { getAnthropicClient } from "@/lib/anthropic/client";
import type { RawArticle } from "@/types";

const BATCH_SIZE = 4;
const MIN_CLEAN_LENGTH = 450;

/**
 * Returns true if the article likely has ad/promotional content mixed in.
 * Checks: content is long (Jina-fetched), OR snippet is very short (article came without preview).
 */
function needsCleaning(article: RawArticle): boolean {
  const full = article.full_content || "";
  if (full.length < MIN_CLEAN_LENGTH) return false;
  const snippet = article.content || "";
  // Jina-fetched: full content is substantially longer than the snippet
  return full.length > snippet.length * 1.5 || snippet.length < 200;
}

/**
 * Clean ad/promotional content from articles using Claude Haiku.
 * The original full_content is preserved in `fetched_articles` cache (stored before this step).
 * This function mutates articles in-place, replacing full_content with the cleaned version.
 */
export async function cleanArticlesContent(articles: RawArticle[]): Promise<RawArticle[]> {
  const toClean = articles.filter(needsCleaning);
  if (toClean.length === 0) return articles;

  for (let i = 0; i < toClean.length; i += BATCH_SIZE) {
    await cleanBatch(toClean.slice(i, i + BATCH_SIZE));
  }

  return articles;
}

async function cleanBatch(articles: RawArticle[]): Promise<void> {
  const client = getAnthropicClient();

  const articleList = articles
    .map((a, i) => `[${i}]\n${(a.full_content || "").slice(0, 2500)}`)
    .join("\n\n---\n\n");

  const prompt = `You are a news content editor. For each article below, remove ONLY advertising, promotional, and non-editorial noise while keeping ALL editorial content intact.

Remove ONLY these:
- Newsletter/subscription calls ("Subscribe", "Assine já", "Inscreva-se", "Receba nossas notícias")
- Social media follow prompts ("Siga-nos no Instagram", "Follow us on Twitter", "Curta nossa página")
- Promotional banners, "Sponsored by", "Parceiro", advertorial disclosures
- Cookie/privacy consent notices embedded mid-article
- App download promotions ("Baixe nosso app")
- Repeating navigation link blocks mixed into article body
- "Veja também:" promotional sidebar lists (but keep inline contextual references to other stories)

Keep EVERYTHING else: all facts, quotes, analysis, data, context, images references, author opinions.
If an article is already clean, return it verbatim — do not change a word.
Do not summarize or rephrase.

Return a JSON array exactly like: [{"index": 0, "content": "cleaned text here"}, ...]
Return ONLY valid JSON, no markdown code fences, no extra text.

Articles:
${articleList}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    // Strip markdown code fences if model adds them anyway
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const results: { index: number; content: string }[] = JSON.parse(jsonText);

    for (const result of results) {
      const article = articles[result.index];
      if (article && result.content && result.content.length >= MIN_CLEAN_LENGTH / 2) {
        article.full_content = result.content;
      }
    }
  } catch {
    // Cleaning failed — original content stays untouched
  }
}
