import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { createAndRunLightScrape, createDeepScrapeJob } from "@/lib/brands/service";
import { isValidWebDomain } from "@/lib/sources/validate-url";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const SELECT_COLS =
  "id, root_url, domain, status, intent, title, favicon_url, total_assets, total_colors, design_system, started_at, finished_at, created_at, parceiro_id, error";

export const GET = withService(async (_req, ctx) => {
  const supabase = accountClient(ctx);
  let q = supabase.from("brand_scrapes").select(SELECT_COLS).order("created_at", { ascending: false });
  q = byAccount(q, ctx);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required");

  const body = await req.json().catch(() => ({}));
  const rootUrl = String(body.root_url || body.url || "").trim();
  if (!rootUrl || !isValidWebDomain(rootUrl)) {
    return NextResponse.json(
      { error: { message: "Valid root_url is required" } },
      { status: 400 }
    );
  }

  const engine: "light" | "deep" = body.engine === "deep" ? "deep" : "light";
  const supabase = accountClient(ctx);

  const input = {
    userId: ctx.user_id,
    accountId: ctx.account_id,
    rootUrl,
    urls: Array.isArray(body.urls) ? body.urls : undefined,
    intent: body.intent,
    parceiroId: body.parceiro_id ?? null,
  };

  if (engine === "deep") {
    const id = await createDeepScrapeJob(supabase, input);
    return NextResponse.json({ data: { id, status: "pending", engine: "deep" } });
  }

  // Light: roda inline (igual ao /api/brands legado). Em after() o pipeline
  // perdia a função antes de terminar e o row ficava preso em pending.
  try {
    const id = await createAndRunLightScrape(supabase, input);
    return NextResponse.json({
      data: { id, status: "completed", engine: "light" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar scrape";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
});
