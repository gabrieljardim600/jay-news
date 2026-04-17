import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverUrls } from "@/lib/brands/url-crawler";
import { isValidWebDomain } from "@/lib/sources/validate-url";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.url !== "string" || !isValidWebDomain(body.url)) {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  try {
    const rootUrl = body.url.includes("://") ? body.url : `https://${body.url}`;
    const urls = await discoverUrls(rootUrl);
    return NextResponse.json({ urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao descobrir URLs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
