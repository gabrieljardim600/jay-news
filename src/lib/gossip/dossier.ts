import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipTopic, GossipDossier, DossierQuote } from "./types";
import { calcSpikeForTopic } from "./spike";

const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM =
  "Você é redator de fofoca brasileira. Escreve curto, tom pop-news, direto. NÃO inventa fato — só usa o que está nos posts. Se não houver fato novo, diz explicitamente 'dia calmo, sem novidade'.";

interface SourceInfo {
  label: string | null;
  tier: string | null;
}

interface PostForDossier {
  id: string;
  title: string | null;
  body: string | null;
  url: string;
  author: string | null;
  published_at: string;
  gossip_sources: SourceInfo | SourceInfo[] | null;
}

function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function generateDossierForTopic(
  supabase: SupabaseClient,
  userId: string,
  topic: GossipTopic,
  date: Date = new Date()
): Promise<GossipDossier | null> {
  const start = new Date(date.getTime() - 24 * 3600_000).toISOString();

  // 1) IDs de posts vinculados ao topic (excluindo manual_negative)
  const { data: linkRows, error: linkErr } = await supabase
    .from("gossip_post_topics")
    .select("post_id, matched_by")
    .eq("topic_id", topic.id)
    .neq("matched_by", "manual_negative");
  if (linkErr) throw linkErr;

  const linkedIds = Array.from(new Set((linkRows ?? []).map((r) => r.post_id as string)));
  if (linkedIds.length === 0) return null;

  // 2) Fetch posts das últimas 24h do user, filtrando pelos IDs linkados
  const { data: postRows, error: postErr } = await supabase
    .from("gossip_posts")
    .select(
      "id, title, body, url, author, published_at, gossip_sources ( label, tier )"
    )
    .eq("user_id", userId)
    .gte("published_at", start)
    .in("id", linkedIds)
    .order("published_at", { ascending: false })
    .limit(40);
  if (postErr) throw postErr;

  const posts = (postRows ?? []) as PostForDossier[];
  if (posts.length === 0) return null;

  const spike = await calcSpikeForTopic(supabase, userId, topic.id, date);

  const postsBlock = posts
    .map((p, i) => {
      const src = firstOrSelf(p.gossip_sources);
      const label = src?.label ?? "?";
      return `${i + 1}. [${label}] ${p.author ?? ""} — "${p.title ?? ""}"\n   ${(p.body ?? "").slice(0, 350)}\n   ${p.url}`;
    })
    .join("\n\n");

  const prompt = `Topic: ${topic.name} (${topic.type})
Posts das últimas 24h (${posts.length}):
${postsBlock}

Retorne JSON estrito:
{
  "summary": "3-5 linhas em português informal",
  "key_quotes": [{"text": "...", "source_label": "...", "url": "..."}],
  "post_ids_used": ["uuid", ...]
}
Se não houver fato novo, summary = "Dia calmo — sem novidade quente sobre ${topic.name}."`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    console.warn(`[gossip:dossier] ${topic.name} — no JSON in Claude response. raw=${text.slice(0, 200)}`);
    return null;
  }
  let parsed: {
    summary?: string;
    key_quotes?: DossierQuote[];
    post_ids_used?: string[];
  };
  try {
    parsed = JSON.parse(m[0]);
  } catch (err) {
    console.warn(`[gossip:dossier] ${topic.name} — JSON.parse falhou:`, err instanceof Error ? err.message : err);
    return null;
  }
  if (!parsed.summary) {
    console.warn(`[gossip:dossier] ${topic.name} — sem summary no JSON. parsed=${JSON.stringify(parsed).slice(0, 200)}`);
    return null;
  }

  const costCents =
    (res.usage.input_tokens / 1_000_000) * 100 +
    (res.usage.output_tokens / 1_000_000) * 500;

  const row = {
    user_id: userId,
    topic_id: topic.id,
    date: date.toISOString().slice(0, 10),
    summary: parsed.summary,
    key_quotes: parsed.key_quotes ?? [],
    spike_score: spike.score,
    spike_level: spike.level,
    post_ids: parsed.post_ids_used ?? posts.map((p) => p.id),
    model: MODEL,
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cost_cents: costCents,
  };

  const { data, error } = await supabase
    .from("gossip_dossiers")
    .upsert(row, { onConflict: "user_id,topic_id,date" })
    .select("*")
    .single();
  if (error) throw error;
  return data as GossipDossier;
}

export async function generateDossiersForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GossipDossier[]> {
  const { data: topics } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);

  const results: GossipDossier[] = [];
  for (const topic of (topics ?? []) as GossipTopic[]) {
    try {
      const d = await generateDossierForTopic(supabase, userId, topic);
      if (d) results.push(d);
    } catch (err) {
      console.error(`[gossip:dossier] erro em ${topic.name}:`, err);
    }
  }
  return results;
}
