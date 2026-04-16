// Quick smoke test for social fetchers — runs them in isolation against real APIs.
// Run: node scripts/test-social-fetchers.mjs

import { readFileSync } from "node:fs";

// Load .env.local manually to avoid dotenv dep
try {
  const env = readFileSync(".env.local", "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {}

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

async function testReddit(sub) {
  console.log(`\n=== Reddit r/${sub} ===`);
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=5&raw_json=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JNews/1.0 (jay-news.vercel.app)" },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const text = await res.text();
      console.log(`Body preview: ${text.slice(0, 200)}`);
      return;
    }
    const data = await res.json();
    const posts = data.data?.children || [];
    console.log(`Got ${posts.length} posts`);
    posts.slice(0, 2).forEach((p, i) => {
      console.log(`  [${i}] ${p.data.title?.slice(0, 60)} (score: ${p.data.score})`);
    });
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

async function testYouTubeRSS(channelId) {
  console.log(`\n=== YouTube RSS channel ${channelId} ===`);
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    if (!res.ok) return;
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].slice(0, 4).map(m => m[1]);
    console.log(`Found ${titles.length} titles. Samples:`);
    titles.forEach((t, i) => console.log(`  [${i}] ${t}`));
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

async function testYouTubeHandleResolution(handle) {
  console.log(`\n=== YouTube handle resolution ${handle} ===`);
  const url = handle.startsWith("http") ? handle : `https://www.youtube.com/${handle.startsWith("@") ? handle : "@" + handle}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 JNews/1.0" },
    });
    console.log(`Status: ${res.status}`);
    if (!res.ok) {
      console.log(`  body preview: ${(await res.text()).slice(0, 200)}`);
      return;
    }
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]+)/);
    console.log(`  resolved channelId: ${m ? m[1] : "NOT FOUND"}`);
    console.log(`  html length: ${html.length}`);
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

async function testTwitter(handle) {
  console.log(`\n=== Twitter via Tavily @${handle} ===`);
  if (!TAVILY_API_KEY) {
    console.log("TAVILY_API_KEY not set, skipping");
    return;
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
      body: JSON.stringify({
        query: `from:${handle}`,
        max_results: 5,
        include_domains: ["twitter.com", "x.com"],
        topic: "general",
        days: 7,
        search_depth: "basic",
      }),
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    if (data.results) {
      console.log(`Got ${data.results.length} results`);
      data.results.slice(0, 3).forEach((r, i) => {
        console.log(`  [${i}] ${r.url}`);
        console.log(`        ${r.title?.slice(0, 80)}`);
      });
    } else {
      console.log(`Response: ${JSON.stringify(data).slice(0, 300)}`);
    }
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

console.log("=== Social fetchers smoke test ===");

// Tests
await testReddit("investimentos");
await testReddit("brasil");
await testYouTubeRSS("UCG_3hhYDD2_h7gYRkfNvVag"); // Stock Pickers
await testYouTubeHandleResolution("@stockpickers");
await testTwitter("stuhlberger");
await testTwitter("Haddad_Fernando");

console.log("\n=== Done ===");
