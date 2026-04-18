import Parser from "rss-parser";
import type { GossipPostInput, GossipSource } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "jay-news-gossip/1.0 (+https://jay-news.vercel.app)" },
});

export async function fetchGossipRss(source: GossipSource): Promise<GossipPostInput[]> {
  // Deixa o erro borbulhar — o collector captura por fonte e reporta na UI.
  // Sem isso, feeds quebrados falhavam silenciosamente e o usuário não
  // conseguia descobrir que a URL está 404.
  let feed;
  try {
    feed = await parser.parseURL(source.handle);
  } catch (err) {
    // Fallback: alguns feeds BR (F5, etc.) têm entities inválidas. Baixa o
    // XML e sanitiza entidades/caracteres de controle antes de reparsear.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/invalid character|unexpected|unclosed|entity/i.test(msg)) throw err;
    const res = await fetch(source.handle, {
      headers: { "User-Agent": "jay-news-gossip/1.0 (+https://jay-news.vercel.app)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} (fallback fetch)`);
    const xml = (await res.text())
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "")
      .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
    feed = await parser.parseString(xml);
  }
  return (feed.items ?? [])
    .filter((item) => item.link)
    .map((item) => ({
      source_id: source.id,
      platform: "rss" as const,
      external_id: String(item.guid ?? item.link!),
      url: item.link!,
      author: item.creator ?? item.author ?? null,
      title: item.title ?? null,
      body: stripHtml(item.contentSnippet ?? item.content ?? ""),
      image_url: extractImage(item as Record<string, unknown>),
      published_at: item.isoDate ?? new Date().toISOString(),
      raw: item,
    }));
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim().slice(0, 4000);
}

function extractImage(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (!enclosure.type || enclosure.type.startsWith("image/"))) {
    return enclosure.url;
  }
  const media = item["media:thumbnail"] as { $?: { url?: string } } | undefined;
  if (media?.$?.url) return media.$.url;
  const content = String(item.content ?? item["content:encoded"] ?? "");
  const m = content.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
}
