import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GossipSourceTier } from "@/lib/gossip/types";

const VALID_TIERS: GossipSourceTier[] = ["primary", "proxy", "aggregator"];

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
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.tier === "string") {
    if (!VALID_TIERS.includes(body.tier as GossipSourceTier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    updates.tier = body.tier;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gossip_sources")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
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
    .from("gossip_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
