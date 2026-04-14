import { getAnthropicClient } from "@/lib/anthropic/client";
import type { RawArticle } from "@/types";

const BATCH_SIZE = 5;
const MIN_CLEAN_LENGTH = 450;

/**
 * Returns true if the article likely has ad/promotional content mixed in.
 * Checks: content is long (Jina-fetched), OR snippet is very short.
 */
function needsCleaning(article: RawArticle): boolean {
  const full = article.full_content || "";
  if (full.length < MIN_CLEAN_LENGTH) return false;
  const snippet = article.content || "";
  return full.length > snippet.length * 1.5 || snippet.length < 200;
}

/**
 * Clean ad/promotional content from articles using Claude Sonnet.
 * Original full_content is preserved in the fetched_articles cache (stored before this step).
 * Mutates articles in-place.
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

  // System instructions are long and stable — cache them to save tokens
  const systemInstructions = `You are a precision news content editor. Your job is to remove non-editorial noise from scraped article text WITHOUT touching the editorial content in any way.

REMOVE ONLY:
- Newsletter/subscription CTAs: "Assine já", "Subscribe", "Receba nossas notícias grátis", "Inscreva-se"
- Social media follow prompts: "Siga-nos no Instagram", "Curta nossa página", "Follow us on Twitter"
- App download promotions: "Baixe nosso app", "Get it on Google Play"
- Promotional sponsor blocks: "Sponsored by", "Parceiro comercial", "Conteúdo patrocinado"
- Cookie/LGPD consent notices embedded in article text
- Repeated navigation blocks or menu lists mixed into body text
- "Veja também:" lists that are clearly promotional sidebar content (e.g., lists of 5+ unrelated links)
- Advertorial disclosures unrelated to the article subject

ALWAYS KEEP:
- All facts, figures, data, statistics
- All quotes from people or documents
- All analysis, context, and editorial opinion
- Inline references to related articles when they are contextually relevant (not just link dumps)
- Author name and publication info if embedded in body
- Corrections or editor's notes

RULES:
- If an article has none of the above noise, return it byte-for-byte unchanged
- Never summarize, paraphrase, or restructure sentences
- Never add any text of your own
- Preserve paragraph breaks and formatting`;

  const articleList = articles
    .map((a, i) => `[${i}]\n${(a.full_content || "").slice(0, 3000)}`)
    .join("\n\n---\n\n");

  const userMessage = `Clean these ${articles.length} article(s) and return a JSON array: [{"index": 0, "content": "cleaned text"}, ...]
Return ONLY valid JSON, no markdown fences.

Articles:
${articleList}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: systemInstructions,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
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
