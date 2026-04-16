import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessionRes, messagesRes] = await Promise.all([
    supabase.from("chat_sessions").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("chat_messages").select("*").eq("session_id", id).order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 });

  return NextResponse.json({
    session: sessionRes.data,
    messages: messagesRes.data || [],
  });
}
