// GET /api/debug/reddit-probe?sub=farialimabets
//
// Endpoint de DEBUG temporario — testa varias estrategias de fetch contra
// Reddit pra identificar qual passa do IP do Vercel. Deletar quando terminar.
//
// Auth: ?secret=<CRON_SECRET>

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sub = url.searchParams.get("sub") || "farialimabets";

  type Variant = { name: string; url: string; ua: string };
  const variants: Variant[] = [
    {
      name: "www-default-ua",
      url: `https://www.reddit.com/r/${sub}/hot.json?limit=3`,
      ua: "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.vercel.app)",
    },
    {
      name: "old-default",
      url: `https://old.reddit.com/r/${sub}/hot.json?limit=3`,
      ua: "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.vercel.app)",
    },
    {
      name: "www-script-ua",
      url: `https://www.reddit.com/r/${sub}/hot.json?limit=3`,
      ua: "JNews/1.0 by /u/anonymous",
    },
    {
      name: "www-firefox-ua",
      url: `https://www.reddit.com/r/${sub}/hot.json?limit=3`,
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    },
    {
      name: "raw-json-suffix",
      url: `https://www.reddit.com/r/${sub}.json?limit=3`,
      ua: "Mozilla/5.0 JNews/1.0",
    },
  ];

  const results = [];
  for (const v of variants) {
    try {
      const r = await fetch(v.url, {
        headers: { "User-Agent": v.ua, Accept: "application/json" },
        cache: "no-store",
      });
      const ct = r.headers.get("content-type") || "";
      const text = await r.text();
      let posts = 0;
      try {
        const j = JSON.parse(text);
        posts = j?.data?.children?.length ?? 0;
      } catch {
        /* not JSON */
      }
      results.push({
        name: v.name,
        status: r.status,
        ct: ct.slice(0, 60),
        bytes: text.length,
        posts,
        body_head: text.slice(0, 200),
      });
    } catch (e) {
      results.push({ name: v.name, error: String(e) });
    }
  }

  return NextResponse.json({ sub, results });
}
