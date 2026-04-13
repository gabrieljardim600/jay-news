import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidRssUrl } from "@/lib/sources/validate-url";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "JNews/1.0" },
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();

  if (!url || !isValidRssUrl(url)) {
    return NextResponse.json({
      status: "error",
      error_code: "INVALID_URL",
      error_message: "URL invalida ou nao permitida",
    });
  }

  try {
    const feed = await parser.parseURL(url);

    if (!feed.items || feed.items.length === 0) {
      return NextResponse.json({
        status: "error",
        error_code: "EMPTY_FEED",
        error_message: "Feed encontrado mas sem artigos",
      });
    }

    const sampleArticles = feed.items.slice(0, 2).map((item) => ({
      title: item.title || "Sem titulo",
      published_at: item.isoDate || null,
      url: item.link || url,
    }));

    return NextResponse.json({
      status: "success",
      feed_name: feed.title || "Feed sem nome",
      total_articles: feed.items.length,
      sample_articles: sampleArticles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("ESOCKETTIMEDOUT")) {
      return NextResponse.json({
        status: "error",
        error_code: "TIMEOUT",
        error_message: "Timeout ao acessar a URL (10s)",
      });
    }

    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
      return NextResponse.json({
        status: "error",
        error_code: "UNREACHABLE",
        error_message: "URL inacessivel — verifique o endereco",
      });
    }

    return NextResponse.json({
      status: "error",
      error_code: "INVALID_RSS",
      error_message: "URL nao e um feed RSS/Atom valido",
    });
  }
}
