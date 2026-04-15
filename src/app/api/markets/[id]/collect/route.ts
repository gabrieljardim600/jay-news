import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { runMarketCollection } from "@/lib/markets/service";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: market } = await supabase.from("markets").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await runMarketCollection(id);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
