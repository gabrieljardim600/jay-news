import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GossipTopic, GossipTopicType } from "@/lib/gossip/types";
import { matchByAliases, persistMatches } from "@/lib/gossip/matcher";

const VALID_TYPES: GossipTopicType[] = ["person", "couple", "event", "show", "brand"];

function normalizeAliases(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("include_inactive") === "1";

  let query = supabase
    .from("gossip_topics")
    .select("*")
    .eq("user_id", user.id);

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query
    .order("priority", { ascending: false })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { type, name, aliases, priority } = body as {
    type?: string;
    name?: string;
    aliases?: unknown;
    priority?: number;
  };

  if (!type || !name) {
    return NextResponse.json({ error: "Missing fields: type, name" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as GossipTopicType)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gossip_topics")
    .insert({
      user_id: user.id,
      type,
      name: String(name).trim(),
      aliases: normalizeAliases(aliases),
      priority: typeof priority === "number" ? priority : 1,
      active: true,
      metadata: {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Backfill: roda matching camada 1 (alias) contra posts já coletados
  // dos últimos 14 dias. Sem isso, um topic novo só pegaria posts futuros.
  let backfilled = 0;
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

  return NextResponse.json({ ...data, _backfilled: backfilled }, { status: 201 });
}
