import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { GossipPost, GossipTopic } from "./types";

export interface MatchResult {
  post_id: string;
  topic_id: string;
  confidence: number;
  matched_by: "alias" | "claude";
}

const PROPER_NOUN_RE = /([A-ZÀ-ÝZ][A-ZÀ-ÝZa-zà-ý]+(?:\s+[A-ZÀ-ÝZ][A-ZÀ-ÝZa-zà-ý]+){1,3})/;

export function hasProperNouns(text: string): boolean {
  return PROPER_NOUN_RE.test(text);
}

export async function matchByClaude(
  post: Pick<GossipPost, "id" | "title" | "body">,
  topics: GossipTopic[]
): Promise<MatchResult[]> {
  if (topics.length === 0) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const prompt = `Dado o post, quais desses topics são mencionados?

POST:
Título: ${post.title ?? ""}
Corpo: ${(post.body ?? "").slice(0, 800)}

TOPICS:
${topics.map((t, i) => `${i + 1}. ${t.name} (${t.type}) — aliases: ${t.aliases.join(", ")}`).join("\n")}

Responda JSON: {"matches":[{"topic_index":1,"confidence":0.8}]}. Só inclua confidence >= 0.6. Array vazio se nada bater.`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]) as { matches?: Array<{ topic_index: number; confidence: number }> };
    return (parsed.matches ?? [])
      .filter((mItem) => mItem.confidence >= 0.6 && topics[mItem.topic_index - 1])
      .map((mItem) => ({
        post_id: post.id,
        topic_id: topics[mItem.topic_index - 1].id,
        confidence: mItem.confidence,
        matched_by: "claude" as const,
      }));
  } catch {
    return [];
  }
}

export function matchByAliases(
  post: Pick<GossipPost, "id" | "title" | "body">,
  topics: GossipTopic[]
): MatchResult[] {
  const haystack = `${post.title ?? ""} ${post.body ?? ""}`.toLowerCase();
  const matches: MatchResult[] = [];
  for (const t of topics) {
    if (!t.active) continue;
    const needles = collectNeedles(t);
    for (const alias of needles) {
      if (alias.length < 3) continue;
      if (aliasMatches(haystack, alias)) {
        matches.push({ post_id: post.id, topic_id: t.id, confidence: 1.0, matched_by: "alias" });
        break;
      }
    }
  }
  return matches;
}

// Acrônimos curtos (<=4, sem espaço, alfanumérico) são tratados como prefixo:
// "bbb" casa com "bbb", "bbb26", "bbb25", "#bbb", "bbbrasil". Aliases mais
// longos exigem boundary de palavra dos dois lados (evita falso positivo tipo
// "anittaola" batendo em "anitta").
function aliasMatches(haystack: string, alias: string): boolean {
  const isShortAcronym = alias.length <= 4 && /^[a-z0-9]+$/.test(alias);
  const escaped = escapeRegex(alias);
  const pattern = isShortAcronym ? `\\b${escaped}\\w*` : `\\b${escaped}\\b`;
  return new RegExp(pattern, "i").test(haystack);
}

// Sempre inclui o próprio nome do topic + aliases. Para "person" também
// aceita o último token (sobrenome) como alias implícito — é o que aparece
// na maioria das menções coloquiais ("Vorcaro fez X" em vez do nome completo).
function collectNeedles(t: GossipTopic): string[] {
  const out = new Set<string>();
  if (t.name) out.add(t.name.toLowerCase().trim());
  for (const a of t.aliases) {
    const v = a.toLowerCase().trim();
    if (v) out.add(v);
  }
  if (t.type === "person" && t.name) {
    const tokens = t.name.trim().split(/\s+/);
    if (tokens.length > 1) {
      const last = tokens[tokens.length - 1].toLowerCase();
      if (last.length >= 4) out.add(last);
    }
  }
  return [...out];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function persistMatches(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<void> {
  if (matches.length === 0) return;
  const { error } = await supabase.from("gossip_post_topics").upsert(
    matches.map((m) => ({
      post_id: m.post_id,
      topic_id: m.topic_id,
      confidence: m.confidence,
      matched_by: m.matched_by,
    })),
    { onConflict: "post_id,topic_id", ignoreDuplicates: false }
  );
  if (error) throw error;
}
