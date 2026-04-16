import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { collectForUser } from "@/lib/social/collector";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await collectForUser(supabase, user.id);
  return NextResponse.json(result);
}
