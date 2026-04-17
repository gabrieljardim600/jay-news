import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAndRunLightScrape, createDeepScrapeJob } from "@/lib/brands/service";

export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data: original, error } = await supabase
    .from("brand_scrapes")
    .select("root_url, urls_to_scrape, engine, intent, parceiro_id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!original || original.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const overrideEngine: "light" | "deep" | undefined =
    body?.engine === "light" || body?.engine === "deep" ? body.engine : undefined;
  const engine = overrideEngine ?? original.engine ?? "light";

  try {
    const params = {
      userId: user.id,
      rootUrl: original.root_url,
      urls: original.urls_to_scrape ?? [],
      intent: original.intent ?? undefined,
      parceiroId: original.parceiro_id,
    };
    const newId =
      engine === "deep"
        ? await createDeepScrapeJob(supabase, params)
        : await createAndRunLightScrape(supabase, params);
    return NextResponse.json({ id: newId, engine });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
