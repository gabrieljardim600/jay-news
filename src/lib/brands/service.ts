import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDomain } from "@/lib/sources/validate-url";
import { discoverUrls } from "./url-crawler";
import { runLightScrape, downloadAssets } from "./brand-scraper";
import { buildDesignSystem } from "./design-system-builder";
import { renderDesignSystemHtml } from "./html-renderer";
import type { ScrapeEngine, ScrapeIntent } from "./types";

export interface CreateScrapeInput {
  userId: string;
  rootUrl: string;
  urls?: string[];
  intent?: ScrapeIntent;
  engine?: ScrapeEngine;
  parceiroId?: string | null;
  accountId?: string | null;
}

/**
 * Cria scrape pendente para a fase DEEP — worker Railway (Puppeteer) processa async.
 * Retorna o id imediatamente; UI faz polling do status.
 */
export async function createDeepScrapeJob(
  supabase: SupabaseClient,
  input: CreateScrapeInput
): Promise<string> {
  const rootUrl = normalizeUrl(input.rootUrl);
  const domain = extractDomain(rootUrl);

  const { data, error } = await supabase
    .from("brand_scrapes")
    .insert({
      user_id: input.userId,
      account_id: input.accountId ?? null,
      root_url: rootUrl,
      domain,
      urls_to_scrape: input.urls ?? [],
      status: "pending",
      engine: "deep",
      intent: input.intent ?? null,
      parceiro_id: input.parceiroId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar job deep");
  return data.id as string;
}

/**
 * Cria o registro do scrape e executa a pipeline leve inline (light engine).
 * Retorna o id criado. Pipeline é rodada dentro do request — MVP sem worker.
 *
 * NOTA: se o escopo crescer (muitas páginas, muitos assets), mover pra um
 * job async com tabela de fila e worker Railway (fase 2).
 */
export async function createAndRunLightScrape(
  supabase: SupabaseClient,
  input: CreateScrapeInput
): Promise<string> {
  const rootUrl = normalizeUrl(input.rootUrl);
  const domain = extractDomain(rootUrl);

  const { data: scrape, error: insertErr } = await supabase
    .from("brand_scrapes")
    .insert({
      user_id: input.userId,
      account_id: input.accountId ?? null,
      root_url: rootUrl,
      domain,
      urls_to_scrape: input.urls ?? [],
      status: "crawling",
      engine: "light",
      intent: input.intent ?? null,
      parceiro_id: input.parceiroId ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !scrape) throw new Error(insertErr?.message ?? "Falha ao criar scrape");
  const scrapeId = scrape.id as string;

  try {
    // 1. Crawl se não veio URL explícita
    const urls =
      input.urls && input.urls.length > 0 ? input.urls : await discoverUrls(rootUrl);

    await supabase
      .from("brand_scrapes")
      .update({ urls_to_scrape: urls, status: "scraping" })
      .eq("id", scrapeId);

    // 2. Light scrape
    const result = await runLightScrape(urls);

    // Se nenhuma página rendeu HTML útil (todas 403/timeout/SPA-vazia), aborta
    // com erro claro em vez de marcar como completed com "insufficient data".
    const fetchedPages = result.pages.filter((p) => p.title || p.description).length;
    if (
      fetchedPages === 0 &&
      result.colors.length === 0 &&
      result.fontFamilies.length === 0 &&
      result.assets.length === 0
    ) {
      throw new Error(
        "Não consegui extrair dados visuais do site. Provavelmente é uma SPA " +
          "renderizada no cliente ou tem proteção anti-bot (Cloudflare/Akamai). " +
          "Use o Deep scrape (Puppeteer) para esse domínio."
      );
    }

    // 3. Download assets → Storage
    const downloaded = await downloadAssets(supabase, result.assets, scrapeId);
    if (downloaded.length > 0) {
      const rows = downloaded.map((d) => ({
        scrape_id: scrapeId,
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

    await supabase
      .from("brand_scrapes")
      .update({ status: "enriching" })
      .eq("id", scrapeId);

    // 4. AI enrichment → design system
    const primaryPage = result.pages[0];
    const designSystem = await buildDesignSystem({
      domain: result.domain,
      pages: result.pages,
      colors: result.colors,
      fontFamilies: result.fontFamilies,
      assets: downloaded,
    });

    // 5. Render HTML preview → Storage
    const previewHtml = renderDesignSystemHtml(designSystem);
    const previewPath = `${scrapeId}/preview/design-system.html`;
    await supabase.storage
      .from("brand-assets")
      .upload(previewPath, new Blob([previewHtml], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    // 6. Persistir resultado
    await supabase
      .from("brand_scrapes")
      .update({
        status: "completed",
        title: primaryPage?.title ?? null,
        description: primaryPage?.description ?? null,
        favicon_url: primaryPage?.faviconUrl ?? null,
        urls_scraped: result.pages.map((p) => p.url),
        total_assets: downloaded.length,
        total_colors: result.colors.length,
        design_system: designSystem,
        html_preview_path: previewPath,
        finished_at: new Date().toISOString(),
      })
      .eq("id", scrapeId);

    return scrapeId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await supabase
      .from("brand_scrapes")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", scrapeId);
    throw err;
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("://")) return trimmed;
  return `https://${trimmed}`;
}
