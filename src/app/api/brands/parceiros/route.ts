import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() ?? "";

  let query = supabase
    .from("crm_parceiros")
    .select("id, nome, nomeFantasia, site, cidade, estado")
    .order("nome", { ascending: true })
    .limit(50);

  if (search) {
    query = query.or(
      `nome.ilike.%${search}%,nomeFantasia.ilike.%${search}%,site.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
