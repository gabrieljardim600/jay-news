import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAllForUser, syncTarget } from "@/lib/social-brand/collector";
import type { SocialBrandTarget } from "@/lib/social-brand/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let targetId: string | null = null;
  try {
    const body = await request.json();
    targetId = body?.target_id ?? null;
  } catch {
    // sem body — sincroniza tudo
  }

  if (targetId) {
    const { data: target } = await supabase
      .from("social_brand_targets")
      .select("*")
      .eq("id", targetId)
      .eq("user_id", user.id)
      .single();
    if (!target) return NextResponse.json({ error: "Target não encontrado" }, { status: 404 });
    const report = await syncTarget(supabase, target as SocialBrandTarget);
    return NextResponse.json({ reports: [report] });
  }

  const reports = await syncAllForUser(supabase, user.id);
  return NextResponse.json({ reports });
}
