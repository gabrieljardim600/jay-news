// GET /api/debug/reddit-probe?sub=farialimabets
//
// Endpoint de DEBUG temporario — testa OAuth Reddit + public JSON variants.
// Auth: ?secret=<CRON_SECRET>
// Use depois de configurar REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET pra
// validar que OAuth funciona antes de esperar o cron.

import { fetchSubreddit } from "@/lib/social/reddit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sub = url.searchParams.get("sub") || "farialimabets";

  // ── 1) Status das envs ──────────────────────────────────────────────────
  const envs = {
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID ? "set" : "missing",
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET ? "set" : "missing",
    REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT ?? "(default)",
  };

  // ── 2) Tentar obter token diretamente (so se as 2 creds existem) ────────
  let oauthCheck: { status: string; detail?: string; token_len?: number } = {
    status: "skipped",
  };
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try {
      const basic = Buffer.from(
        `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
      ).toString("base64");
      const r = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": process.env.REDDIT_USER_AGENT || "JNews/1.0",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      });
      const text = await r.text();
      if (!r.ok) {
        oauthCheck = { status: `http_${r.status}`, detail: text.slice(0, 200) };
      } else {
        const j = JSON.parse(text) as { access_token?: string };
        oauthCheck = {
          status: j.access_token ? "ok" : "no_token_in_response",
          token_len: j.access_token?.length,
        };
      }
    } catch (e) {
      oauthCheck = { status: "exception", detail: String(e).slice(0, 200) };
    }
  }

  // ── 3) Chamar fetchSubreddit (que ja usa OAuth se configurado) ──────────
  let collectorCheck: { posts: number; sample?: string[]; error?: string } = {
    posts: 0,
  };
  try {
    const posts = await fetchSubreddit(sub, 5);
    collectorCheck = {
      posts: posts.length,
      sample: posts.slice(0, 3).map((p) => `${p.title?.slice(0, 60)} (${p.author})`),
    };
  } catch (e) {
    collectorCheck = { posts: 0, error: String(e).slice(0, 200) };
  }

  return NextResponse.json({
    sub,
    envs,
    oauth_token_check: oauthCheck,
    collector_fetch: collectorCheck,
  });
}
