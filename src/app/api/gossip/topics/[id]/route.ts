import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchByAliases, persistMatches } from "@/lib/gossip/matcher";
import type { GossipTopic } from "@/lib/gossip/types";

function normalizeAliases(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (Array.isArray(body.aliases)) updates.aliases = normalizeAliases(body.aliases);
  if (typeof body.priority === "number") updates.priority = body.priority;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.image_url === "string" || body.image_url === null) updates.image_url = body.image_url;
  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    updates.metadata = body.metadata;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gossip_topics")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Se aliases ou name mudaram, roda backfill nos posts dos últimos 14d
  // pra pegar posts já coletados que agora casam com as novas aliases.
  let backfilled = 0;
  const touchedMatching = updates.aliases !== undefined || updates.name !== undefined;
  if (touchedMatching) {
    try {
      const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
      const { data: postRows } = await supabase
        .from("gossip_posts")
        .select("id, title, body")
        .eq("user_id", user.id)
        .gte("published_at", since)
        .limit(2000);
      const posts = (postRows ?? []) as Array<{ id: string; title: string | null; body: string | null }>;
      const matches = posts.flatMap((p) => matchByAliases(p, [data as GossipTopic]));
      if (matches.length > 0) {
        await persistMatches(supabase, matches);
        backfilled = matches.length;
      }
    } catch (err) {
      console.warn("[gossip:topics] backfill falhou", err);
    }
  }

  return NextResponse.json({ ...data, _backfilled: backfilled });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { error } = await supabase
    .from("gossip_topics")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
