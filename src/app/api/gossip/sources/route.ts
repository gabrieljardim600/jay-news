import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GossipPlatform, GossipSourceTier } from "@/lib/gossip/types";

const VALID_PLATFORMS: GossipPlatform[] = ["rss", "twitter", "youtube", "reddit"];
const VALID_TIERS: GossipSourceTier[] = ["primary", "proxy", "aggregator"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("gossip_sources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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

  const { platform, handle, label, tier } = body as {
    platform?: string;
    handle?: string;
    label?: string;
    tier?: string;
  };

  if (!platform || !handle || !label) {
    return NextResponse.json({ error: "Missing fields: platform, handle, label" }, { status: 400 });
  }

  if (!VALID_PLATFORMS.includes(platform as GossipPlatform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const finalTier: GossipSourceTier = tier && VALID_TIERS.includes(tier as GossipSourceTier)
    ? (tier as GossipSourceTier)
    : "primary";

  const { data, error } = await supabase
    .from("gossip_sources")
    .insert({
      user_id: user.id,
      platform,
      handle: String(handle).trim(),
      label: String(label).trim(),
      tier: finalTier,
      active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
