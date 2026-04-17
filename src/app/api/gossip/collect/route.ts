import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectGossipForUser } from "@/lib/gossip/collector";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await collectGossipForUser(supabase, user.id);
  return NextResponse.json(report);
}
