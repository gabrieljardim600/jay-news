import Anthropic from "@anthropic-ai/sdk";
import type { GossipTopicType } from "./types";

export async function suggestAliases(name: string, type: GossipTopicType): Promise<string[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Você ajuda a identificar variações de um nome/entidade em posts de fofoca.
Dado "${name}" (tipo: ${type}), liste 4-8 variantes (apelidos, abreviações, handles @, grafias alternativas) que podem aparecer em posts BR e internacionais.
Não inclua nomes de família genéricos ("Silva", "Santos", "Smith"). Não inclua palavras com menos de 3 chars.
Retorne JSON estrito: {"aliases": ["variante1", "variante2", ...]}.`,
    }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [name.toLowerCase()];
  try {
    const parsed = JSON.parse(m[0]) as { aliases?: string[] };
    const normalized = [name.toLowerCase(), ...((parsed.aliases ?? []).map((a) => a.toLowerCase()))];
    return Array.from(new Set(normalized)).filter((a) => a.length >= 3);
  } catch {
    return [name.toLowerCase()];
  }
}
