/**
 * Usage: npx tsx scripts/test-briefing.ts <marketId> <competitorId>
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

import { generateCompetitorBriefing } from "../src/lib/markets/briefing";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [marketId, competitorId] = process.argv.slice(2);
  if (!marketId || !competitorId) { console.error("Usage: tsx scripts/test-briefing.ts <marketId> <competitorId>"); process.exit(1); }

  console.log("▶ Generating briefing...");
  const t0 = Date.now();
  const { briefingId } = await generateCompetitorBriefing(marketId, competitorId);
  console.log(`✓ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s — id=${briefingId}`);

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await svc.from("competitor_briefings").select("*").eq("id", briefingId).single();
  console.log("\nStatus:", data?.status);
  console.log("Data quality:", data?.data_quality);
  console.log("Articles analyzed:", data?.articles_analyzed);
  console.log("\nRESUMO:\n", data?.resumo);
  console.log("\nCONTENT keys:", data?.content ? Object.keys(data.content) : "(none)");
  if (data?.content?.pontos_fortes) console.log("\nPontos fortes:", data.content.pontos_fortes);
  if (data?.content?.pontos_fracos) console.log("\nPontos fracos:", data.content.pontos_fracos);
  if (data?.content?.produtos) console.log("\nProdutos:", data.content.produtos);
  if (data?.content?.movimentos_recentes) console.log("\nMovimentos:", data.content.movimentos_recentes);
}

main().catch((e) => { console.error(e); process.exit(1); });
