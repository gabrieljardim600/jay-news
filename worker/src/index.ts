import { getSupabase } from "./supabase.js";
import { runDeepScrape } from "./puppeteer-scraper.js";
import { downloadAndUpload, uploadScreenshot } from "./download-to-storage.js";
import { buildDesignSystem } from "./design-system-builder.js";
import { renderDesignSystemHtml } from "./html-renderer.js";
import type { BrandScrapeRow, DownloadedAsset } from "./types.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "5000", 10);
const CONCURRENCY = 4;

async function main() {
  console.log("[worker] Jay News brand scraper worker iniciando...");
  console.log(`[worker] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // loop infinito com tratamento de erros
  while (true) {
    try {
      const job = await claimNextJob();
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      console.log(`[worker] processando job ${job.id} — ${job.root_url}`);
      await processJob(job);
    } catch (err) {
      console.error("[worker] erro no loop:", err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

async function claimNextJob(): Promise<BrandScrapeRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("brand_scrapes")
    .select("id, user_id, root_url, domain, urls_to_scrape, engine, intent, parceiro_id")
    .eq("status", "pending")
    .eq("engine", "deep")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[worker] erro ao buscar job:", error.message);
    return null;
  }
  if (!data) return null;

  // Marca como crawling pra não pegar de novo (sem row lock real, mas OK pra uma instância)
  const { error: updErr } = await supabase
    .from("brand_scrapes")
    .update({ status: "crawling", started_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("status", "pending");

  if (updErr) return null;
  return data as BrandScrapeRow;
}

async function processJob(job: BrandScrapeRow) {
  const supabase = getSupabase();
  try {
    const urls = job.urls_to_scrape.length > 0 ? job.urls_to_scrape : [normalize(job.root_url)];

    await supabase
      .from("brand_scrapes")
      .update({ status: "scraping", urls_to_scrape: urls })
      .eq("id", job.id);

    const result = await runDeepScrape(normalize(job.root_url), urls);

    // Downloads em batches
    const downloaded: DownloadedAsset[] = [];
    for (let i = 0; i < result.assets.length; i += CONCURRENCY) {
      const batch = result.assets.slice(i, i + CONCURRENCY);
      const res = await Promise.all(
        batch.map((asset) => downloadAndUpload(supabase, asset, job.id))
      );
      for (const item of res) if (item) downloaded.push(item);
    }

    // Screenshots
    for (const shot of result.screenshots) {
      const uploaded = await uploadScreenshot(supabase, shot.pageUrl, shot.buffer, job.id);
      if (uploaded) downloaded.push(uploaded);
    }

    if (downloaded.length > 0) {
      const rows = downloaded.map((d) => ({
        scrape_id: job.id,
        type: d.type,
        original_url: d.originalUrl,
        source_page_url: d.sourcePageUrl,
        storage_path: d.storagePath,
        public_url: d.publicUrl,
        file_size_kb: d.fileSizeKb,
        mime_type: d.mimeType,
        width: d.width ?? null,
        height: d.height ?? null,
        metadata: { alt: d.alt ?? null },
      }));
      await supabase.from("brand_assets").insert(rows);
    }

    await supabase.from("brand_scrapes").update({ status: "enriching" }).eq("id", job.id);

    const ds = await buildDesignSystem({
      domain: result.domain,
      pages: result.pages,
      colors: result.colors,
      fontFamilies: result.fontFamilies,
      assets: downloaded,
    });

    const html = renderDesignSystemHtml(ds);
    const htmlPath = `${job.id}/preview/design-system.html`;
    await supabase.storage
      .from("brand-assets")
      .upload(htmlPath, new TextEncoder().encode(html), {
        contentType: "text/html",
        upsert: true,
      });

    const primary = result.pages[0];
    await supabase
      .from("brand_scrapes")
      .update({
        status: "completed",
        title: primary?.title ?? null,
        description: primary?.description ?? null,
        favicon_url: primary?.faviconUrl ?? null,
        urls_scraped: result.pages.map((p) => p.url),
        total_assets: downloaded.length,
        total_colors: result.colors.length,
        design_system: ds,
        html_preview_path: htmlPath,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    console.log(`[worker] job ${job.id} completed — ${downloaded.length} assets, ${result.colors.length} colors`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[worker] job ${job.id} failed:`, msg);
    await supabase
      .from("brand_scrapes")
      .update({
        status: "failed",
        error: msg,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function normalize(url: string): string {
  return url.includes("://") ? url : `https://${url}`;
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
