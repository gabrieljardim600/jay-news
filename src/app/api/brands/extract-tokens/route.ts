import { NextResponse } from "next/server";
import { createClient as createSupaClient } from "@supabase/supabase-js";
import { createAndRunLightScrape, createDeepScrapeJob } from "@/lib/brands/service";
import { isValidWebDomain } from "@/lib/sources/validate-url";

export const maxDuration = 300;

/**
 * Endpoint server-to-server (sem auth de usuário) pra extrair design system
 * de uma URL. Usado pelo whitelabel-v1 (Arena) e plataforma-corban-prototype
 * pra importar marca rapidinho dentro do builder de identidade.
 *
 * Auth: header `Authorization: Bearer <BRAND_EXTRACT_KEY>` (env var no JayNews).
 *
 * POST { url, engine?: "light"|"deep" } — cria scrape; "light" retorna sincronamente
 * com design_system populado, "deep" retorna {scrape_id, status: "pending"} e
 * cliente faz polling no GET ?id=xxx.
 *
 * GET ?id=<scrape_id> — retorna status + design_system se completo.
 *
 * Implementação: usa BRAND_EXTRACT_USER_ID (env var) como dono do row porque
 * user_id é NOT NULL na tabela.
 */

function authCheck(request: Request): NextResponse | null {
  const expectedKey = process.env.BRAND_EXTRACT_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "endpoint_disabled" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  if (provided !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function getServiceClient() {
  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function loadScrape(supabase: ReturnType<typeof getServiceClient>, id: string) {
  const { data: scrape, error } = await supabase
    .from("brand_scrapes")
    .select("id, root_url, domain, status, design_system, favicon_url, title, total_assets, total_colors, error, engine, created_at, finished_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  if (!scrape) throw new Error("scrape_not_found");

  const { data: assets } = await supabase
    .from("brand_assets")
    .select("type, role, original_url, public_url, width, height")
    .eq("scrape_id", id)
    .order("type");

  return {
    scrape_id: scrape.id,
    domain: scrape.domain,
    title: scrape.title,
    status: scrape.status,
    engine: scrape.engine,
    favicon_url: scrape.favicon_url,
    design_system: scrape.design_system,
    assets: assets ?? [],
    total_assets: scrape.total_assets,
    total_colors: scrape.total_colors,
    error: scrape.error,
    created_at: scrape.created_at,
    finished_at: scrape.finished_at,
  };
}

export async function POST(request: Request) {
  const authErr = authCheck(request);
  if (authErr) return authErr;

  const userId = process.env.BRAND_EXTRACT_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "missing_extract_user_id" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !isValidWebDomain(body.url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const engine: "light" | "deep" = body.engine === "deep" ? "deep" : "light";
  const supabase = getServiceClient();

  try {
    if (engine === "deep") {
      // Cria job pendente — worker Railway processa via Puppeteer
      const id = await createDeepScrapeJob(supabase, {
        userId,
        rootUrl: body.url,
        intent: "whitelabel",
      });
      // Retorna immediately — cliente faz polling em GET ?id=xxx
      return NextResponse.json({
        scrape_id: id,
        status: "pending",
        engine: "deep",
        message: "Job criado. Polling necessário em GET ?id=" + id,
      });
    }

    // Light scrape: roda inline (~10-15s)
    const id = await createAndRunLightScrape(supabase, {
      userId,
      rootUrl: body.url,
      intent: "whitelabel",
    });
    const result = await loadScrape(supabase, id);
    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error ?? "scrape_failed", scrape_id: id, hint: "Tente engine='deep' para sites com SPA / anti-bot" },
        { status: 422 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "scrape_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authErr = authCheck(request);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const supabase = getServiceClient();
  try {
    const result = await loadScrape(supabase, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "load_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
