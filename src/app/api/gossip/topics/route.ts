import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GossipTopicType } from "@/lib/gossip/types";

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
  return NextResponse.json(data ?? []);
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
  return NextResponse.json(data, { status: 201 });
}
