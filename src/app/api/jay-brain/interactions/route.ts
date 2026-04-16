import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action, target_type, target_id, payload } = body;
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const { error } = await supabase.from("user_interactions").insert({
    user_id: user.id,
    action,
    target_type: target_type || null,
    target_id: target_id || null,
    payload: payload || {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
