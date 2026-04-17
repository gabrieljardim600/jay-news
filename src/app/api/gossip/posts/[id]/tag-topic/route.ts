import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { topic_id: topicId, action } = body as {
    topic_id?: string;
    action?: string;
  };

  if (!topicId || typeof topicId !== "string") {
    return NextResponse.json({ error: "Missing topic_id" }, { status: 400 });
  }
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Check explícito: post precisa ser do user (RLS já cuida, mas clareza)
  const { data: post, error: postErr } = await supabase
    .from("gossip_posts")
    .select("id")
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Check topic também do user
  const { data: topic, error: topicErr } = await supabase
    .from("gossip_topics")
    .select("id")
    .eq("id", topicId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const row =
    action === "confirm"
      ? { post_id: postId, topic_id: topicId, confidence: 1.0, matched_by: "manual" as const }
      : { post_id: postId, topic_id: topicId, confidence: 0.0, matched_by: "manual_negative" as const };

  const { error } = await supabase
    .from("gossip_post_topics")
    .upsert(row, { onConflict: "post_id,topic_id", ignoreDuplicates: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
