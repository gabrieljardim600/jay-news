import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestAliases } from "@/lib/gossip/aliases";
import type { GossipTopicType } from "@/lib/gossip/types";

const VALID_TYPES: GossipTopicType[] = ["person", "couple", "event", "show", "brand"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { name, type } = body as { name?: string; type?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }
  if (!type || !VALID_TYPES.includes(type as GossipTopicType)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const aliases = await suggestAliases(name.trim(), type as GossipTopicType);
    return NextResponse.json({ aliases });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to suggest aliases" },
      { status: 500 }
    );
  }
}
