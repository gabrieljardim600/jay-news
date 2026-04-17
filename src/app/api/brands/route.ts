import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAndRunLightScrape, createDeepScrapeJob } from "@/lib/brands/service";
import { isValidWebDomain } from "@/lib/sources/validate-url";

export const maxDuration = 300;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("brand_scrapes")
    .select("id, root_url, domain, status, intent, title, favicon_url, total_assets, total_colors, design_system, created_at, finished_at, parceiro_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !isValidWebDomain(body.url)) {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  const engine = body.engine === "deep" ? "deep" : "light";

  try {
    const params = {
      userId: user.id,
      rootUrl: body.url,
      urls: Array.isArray(body.urls) ? body.urls : undefined,
      intent: body.intent ?? undefined,
      parceiroId: body.parceiro_id ?? null,
    };
    const id =
      engine === "deep"
        ? await createDeepScrapeJob(supabase, params)
        : await createAndRunLightScrape(supabase, params);
    return NextResponse.json({ id, engine });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar scrape";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
