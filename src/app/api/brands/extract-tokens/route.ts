import { NextResponse } from "next/server";
import { createClient as createSupaClient } from "@supabase/supabase-js";
import { createAndRunLightScrape } from "@/lib/brands/service";
import { isValidWebDomain } from "@/lib/sources/validate-url";

export const maxDuration = 300;

/**
 * Endpoint server-to-server (sem auth de usuário) pra extrair design system
 * de uma URL. Usado pelo whitelabel-v1 (Arena) pra importar marca rapidinho
 * dentro do builder de identidade.
 *
 * Auth: header `Authorization: Bearer <BRAND_EXTRACT_KEY>` (env var no JayNews).
 *
 * Implementação: cria brand_scrape rodando como o usuário fixo
 * BRAND_EXTRACT_USER_ID (env var) — necessário porque user_id é NOT NULL na
 * tabela. Light scrape é síncrono (~10-15s), retorna o design_system direto.
 */
export async function POST(request: Request) {
  // 1. Auth via service key
  const expectedKey = process.env.BRAND_EXTRACT_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "endpoint_disabled" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  if (provided !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.BRAND_EXTRACT_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "missing_extract_user_id" }, { status: 500 });
  }

  // 2. Body validation
  const body = await request.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !isValidWebDomain(body.url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // 3. Service-role Supabase pra contornar RLS (estamos em contexto server-to-server)
  const supabase = createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  try {
    const id = await createAndRunLightScrape(supabase, {
      userId,
      rootUrl: body.url,
      intent: body.intent ?? "brand_import",
    });

    // 4. Light scrape termina síncrono dentro do helper. Re-busca o row
    // pra retornar o design_system populado.
    const { data: scrape, error } = await supabase
      .from("brand_scrapes")
      .select("id, root_url, domain, status, design_system, favicon_url, title, total_assets, total_colors, error")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    if (!scrape) throw new Error("scrape_not_found");
    if (scrape.status === "failed") {
      return NextResponse.json({ error: scrape.error ?? "scrape_failed", scrape_id: id }, { status: 422 });
    }

    // 5. Anexa lista de assets baixados (logos, screenshots) pro consumer.
    const { data: assets } = await supabase
      .from("brand_assets")
      .select("type, role, original_url, public_url, width, height")
      .eq("scrape_id", id)
      .order("type");

    return NextResponse.json({
      scrape_id: id,
      domain: scrape.domain,
      title: scrape.title,
      favicon_url: scrape.favicon_url,
      design_system: scrape.design_system,
      assets: assets ?? [],
      total_assets: scrape.total_assets,
      total_colors: scrape.total_colors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "scrape_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
