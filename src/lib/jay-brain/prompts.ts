import type { WatchlistItem, ChatContextType, Article } from "@/types";

// ─── System prompt ───────────────────────────────────────────────────────────

export function buildJaySystemPrompt(language: string = "pt-BR"): string {
  const isPt = language === "pt-BR";
  return isPt
    ? `Você é o Jay — analista pessoal de notícias e mercado do usuário.

ESTILO:
- Direto, denso, sem rodeios. Frases curtas e afirmativas.
- Português do Brasil. Tom analítico, não promocional.
- Sem listas longas. Prefira parágrafos enxutos.
- Quando citar fatos da notícia ou contexto fornecido, mencione a fonte entre parênteses (ex.: "(Reuters)").

LIMITES:
- Não invente dados. Se não souber ou se a informação não estiver no contexto, diga claramente.
- Não dê recomendação financeira de compra/venda. Pode analisar implicações de mercado, riscos e cenários.
- Se o usuário perguntar algo fora do escopo do contexto, responda mesmo assim — mas mantenha a concisão.

QUANDO CRUZAR COM A WATCHLIST:
- Se o assunto tocar itens da watchlist do usuário, conecte explicitamente: "Isso afeta [item] porque...".`
    : `You are Jay — the user's personal news and markets analyst.

STYLE:
- Direct, dense, no fluff. Short, affirmative sentences.
- English. Analytical, non-promotional tone.
- Avoid long bullet lists. Prefer tight prose.
- When citing facts from the article or context, name the source in parens (e.g. "(Reuters)").

LIMITS:
- Never invent data. Say so if you don't know or if it's not in the context.
- Don't give buy/sell financial recommendations. Analyze market implications, risks, and scenarios.
- If the user asks something off-scope, still answer — but stay concise.

WHEN CROSSING WITH WATCHLIST:
- If the subject touches the user's watchlist, connect it explicitly.`;
}

// ─── Context block ───────────────────────────────────────────────────────────

export interface BuiltContext {
  watchlist: WatchlistItem[];
  recentInteractionsSummary: string | null;
  scopeType: ChatContextType;
  scopeArticle?: Pick<Article, "title" | "summary" | "full_content" | "source_name" | "source_url" | "published_at"> & { id?: string };
  scopeDigestSummary?: string | null;
  historicalHits?: { title: string; source_name: string; published_at: string | null; summary: string }[];
}

export function formatContextBlock(ctx: BuiltContext): string {
  const parts: string[] = [];

  if (ctx.watchlist.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const w of ctx.watchlist) {
      (grouped[w.kind] ||= []).push(w.label);
    }
    const lines = Object.entries(grouped).map(
      ([kind, labels]) => `  ${kind}: ${labels.join(", ")}`
    );
    parts.push(`<watchlist>\n${lines.join("\n")}\n</watchlist>`);
  }

  if (ctx.recentInteractionsSummary) {
    parts.push(`<recent_interest>\n${ctx.recentInteractionsSummary}\n</recent_interest>`);
  }

  if (ctx.scopeType === "article" && ctx.scopeArticle) {
    const a = ctx.scopeArticle;
    const body = (a.full_content || a.summary || "").slice(0, 4000);
    parts.push(
      `<current_article>\nTitle: ${a.title}\nSource: ${a.source_name}\nPublished: ${a.published_at || "unknown"}\nURL: ${a.source_url}\n\nContent:\n${body}\n</current_article>`
    );
  }

  if (ctx.scopeType === "digest" && ctx.scopeDigestSummary) {
    parts.push(`<current_digest_summary>\n${ctx.scopeDigestSummary}\n</current_digest_summary>`);
  }

  if (ctx.historicalHits && ctx.historicalHits.length > 0) {
    const lines = ctx.historicalHits
      .slice(0, 8)
      .map((h) => `  • [${h.published_at?.slice(0, 10) || "?"}] ${h.source_name}: ${h.title} — ${h.summary.slice(0, 180)}`)
      .join("\n");
    parts.push(`<related_history>\n${lines}\n</related_history>`);
  }

  if (parts.length === 0) return "";
  return `Context for this conversation:\n\n${parts.join("\n\n")}`;
}

// ─── Quick action templates ──────────────────────────────────────────────────

export function buildQuickActionMessage(variant: "deepen" | "impact" | "history", articleTitle: string): string {
  switch (variant) {
    case "deepen":
      return `Aprofunda essa notícia ("${articleTitle}"): contexto, atores principais, o que está por trás e desdobramentos prováveis.`;
    case "impact":
      return `Como essa notícia ("${articleTitle}") impacta os itens da minha watchlist? Conecte de forma específica e dê magnitude (alto/médio/baixo) por item.`;
    case "history":
      return `Cruza essa notícia ("${articleTitle}") com o histórico recente — episódios similares, padrões que se repetem, e o que aconteceu nos casos anteriores.`;
  }
}
