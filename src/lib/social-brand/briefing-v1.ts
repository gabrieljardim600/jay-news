// Versão account-scoped do briefing. Mantém briefing.ts legado intacto.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";

interface BriefingHighlight {
  brand: string;
  platform: string;
  kind: string;
  caption_excerpt: string;
  permalink: string | null;
  posted_at: string | null;
}

export async function generateBriefingForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{
  id: string | null;
  summary: string;
  highlights: BriefingHighlight[];
  posts_count: number;
  ads_count: number;
  targets_count: number;
} | null> {
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from("social_brand_posts")
    .select(
      "id,kind,platform,caption,permalink,posted_at,target_id,social_brand_targets!inner(label,account_id)",
    )
    .eq("account_id", accountId)
    .gte("fetched_at", since)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(80);

  if (!posts || posts.length === 0) return null;

  type PostRow = {
    id: string;
    kind: string;
    platform: string;
    caption: string | null;
    permalink: string | null;
    posted_at: string | null;
    target_id: string;
    social_brand_targets: { label: string } | { label: string }[];
  };
  const rows = posts as unknown as PostRow[];

  const labelOf = (r: PostRow): string => {
    const t = r.social_brand_targets;
    return Array.isArray(t) ? t[0]?.label ?? "?" : t?.label ?? "?";
  };

  const highlights: BriefingHighlight[] = rows.slice(0, 25).map((r) => ({
    brand: labelOf(r),
    platform: r.platform,
    kind: r.kind,
    caption_excerpt: (r.caption ?? "").slice(0, 220),
    permalink: r.permalink,
    posted_at: r.posted_at,
  }));

  const adsCount = rows.filter((r) => r.kind === "ad").length;
  const postsCount = rows.length - adsCount;
  const targetsSet = new Set(rows.map((r) => r.target_id));

  const items = rows
    .slice(0, 50)
    .map((r, i) => {
      const cap = (r.caption ?? "").slice(0, 200).replace(/\s+/g, " ");
      return `[${i + 1}] ${labelOf(r)} — ${r.platform}/${r.kind} — ${r.posted_at ?? "sem data"}\n${cap}`;
    })
    .join("\n\n");

  const prompt = `Você é um analista de inteligência competitiva. Abaixo estão posts e anúncios novos das últimas 36h das marcas que o usuário está monitorando.

Gere um BRIEFING EXECUTIVO em português, em markdown bem estruturado. Use sub-headers (###) e bullets curtos.

ESTRUTURA OBRIGATÓRIA (use ### como sub-headers, mantenha a ordem):

### Tendências cross-brand
2-4 bullets sobre padrões que aparecem em mais de uma marca (mesmo tema, mesma narrativa, mesmo formato). Se nenhum padrão claro: 1 bullet dizendo isso.

### Lançamentos e movimentos
2-4 bullets com lançamentos, promoções, mudanças de mensagem ou pivôs estratégicos. Cite a marca em **bold** logo no início do bullet.

### Anúncios pagos
2-3 bullets analisando ads (kind=ad). O que a estratégia paga sugere? Quais marcas estão ativas? Se não houver ads novos, diga "Nenhum ad novo no período" e pule.

### Marcas em foco vs silenciadas
1-2 bullets identificando: quem postou muito, quem ficou parado, e o que isso pode indicar.

REGRAS DE ESTILO:
- Comece cada bullet por nome da marca em **negrito** quando a observação for sobre uma marca específica
- Bullets curtos — 1 a 2 linhas cada
- Sem introdução, sem conclusão, sem despedida
- Markdown puro (### para headers, ** para bold, - para bullets)

Conteúdo:
${items}`;

  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const summary = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  const today = new Date().toISOString().slice(0, 10);

  const { data: inserted } = await supabase
    .from("social_brand_briefings")
    .upsert(
      {
        account_id: accountId,
        date: today,
        summary,
        highlights,
        posts_count: postsCount,
        ads_count: adsCount,
        targets_count: targetsSet.size,
      },
      { onConflict: "account_id,date" },
    )
    .select("id")
    .single();

  await supabase
    .from("social_brand_posts")
    .update({ in_digest: true })
    .eq("account_id", accountId)
    .in("id", rows.map((r) => r.id));

  return {
    id: inserted?.id ?? null,
    summary,
    highlights,
    posts_count: postsCount,
    ads_count: adsCount,
    targets_count: targetsSet.size,
  };
}
