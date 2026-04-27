import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestForNiche } from "@/lib/social-brand/niche-suggester";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { niche } = await request.json();
  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche obrigatório" }, { status: 400 });
  }

  const suggestions = await suggestForNiche(niche.trim());
  return NextResponse.json({ suggestions });
}
