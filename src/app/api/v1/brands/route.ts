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
import { after } from "next/server";

export const maxDuration = 300;

const SELECT_COLS =
  "id, root_url, domain, status, intent, title, favicon_url, total_assets, total_colors, design_system, started_at, finished_at, created_at, parceiro_id";

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

  // Light: pre-create row, run pipeline async via after()
  const { data: row, error: insertErr } = await supabase
    .from("brand_scrapes")
    .insert({
      user_id: ctx.user_id,
      account_id: ctx.account_id,
      root_url: rootUrl,
      domain: new URL(rootUrl.startsWith("http") ? rootUrl : `https://${rootUrl}`).hostname,
      urls_to_scrape: input.urls ?? [],
      status: "pending",
      engine: "light",
      intent: input.intent ?? null,
      parceiro_id: input.parceiroId ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    return NextResponse.json(
      { error: { message: insertErr?.message || "Failed to create scrape" } },
      { status: 500 }
    );
  }
  const placeholderId = row.id;

  after(async () => {
    try {
      await createAndRunLightScrape(supabase, input);
      // Mark placeholder as superseded — the function above creates its own row
      await supabase
        .from("brand_scrapes")
        .update({ status: "superseded", error: "placeholder for v1 endpoint" })
        .eq("id", placeholderId);
    } catch (err) {
      await supabase
        .from("brand_scrapes")
        .update({ status: "failed", error: String(err) })
        .eq("id", placeholderId);
    }
  });

  return NextResponse.json({
    data: { id: placeholderId, status: "pending", engine: "light" },
  });
});
