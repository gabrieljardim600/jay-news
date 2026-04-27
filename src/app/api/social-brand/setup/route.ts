// Helper de setup: lista as Pages do FB associadas ao app e seus
// instagram_business_account IDs. Útil pra descobrir META_PIVOT_IG_ID.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.META_ACCESS_TOKEN || process.env.META_AD_LIBRARY_TOKEN;
  if (!token) return NextResponse.json({ error: "META_ACCESS_TOKEN não configurado" }, { status: 500 });

  const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message, raw: data.error }, { status: 500 });

  const pages = (data.data ?? []).map((p: { id: string; name: string; instagram_business_account?: { id: string; username?: string } }) => ({
    page_id: p.id,
    page_name: p.name,
    ig_account_id: p.instagram_business_account?.id ?? null,
    ig_username: p.instagram_business_account?.username ?? null,
  }));

  return NextResponse.json({
    pages,
    hint: "Use o ig_account_id de uma das páginas como META_PIVOT_IG_ID em .env.local",
  });
}
