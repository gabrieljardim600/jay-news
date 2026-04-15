/**
 * Runs a real market collection using env from .env.local.
 * Usage: npx tsx scripts/test-market-collect.ts <marketId>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
} catch {}

import { runMarketCollection } from "../src/lib/markets/service";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const marketId = process.argv[2];
  if (!marketId) { console.error("Usage: npx tsx scripts/test-market-collect.ts <marketId>"); process.exit(1); }

  console.log(`▶ Collecting for ${marketId}...`);
  const t0 = Date.now();
  const result = await runMarketCollection(marketId);
  console.log(`✓ ${result.articlesNew} new / ${result.articlesFound} total in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await svc
    .from("market_articles")
    .select("title, source_name, relevance_score, found_via, mentioned_competitor_ids")
    .eq("market_id", marketId)
    .order("relevance_score", { ascending: false })
    .limit(20);
  console.log("\nTop results:");
  for (const a of data || []) {
    const m = Array.isArray(a.mentioned_competitor_ids) ? a.mentioned_competitor_ids.length : 0;
    console.log(`  [${a.found_via}] ${a.source_name.padEnd(25)} score=${a.relevance_score} m=${m}  ${a.title.slice(0, 80)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
