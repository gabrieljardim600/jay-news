import { createClient } from "@/lib/supabase/server";
import { generateDigest } from "@/lib/digest/generator";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  // Cron path: generate for all configs scheduled for the current hour
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const currentHour = String(now.getUTCHours()).padStart(2, "0") + ":00";
    const nextHour = String((now.getUTCHours() + 1) % 24).padStart(2, "0") + ":00";

    const { data: configs } = await supabase
      .from("digest_configs")
      .select("id, user_id")
      .eq("is_active", true)
      .gte("digest_time", currentHour)
      .lt("digest_time", nextHour);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: "No configs scheduled for this hour" }, { status: 200 });
    }

    const results = [];
    for (const config of configs) {
      try {
        const digestId = await generateDigest(config.user_id, "scheduled", config.id);
        results.push({ configId: config.id, digestId, status: "processing" });
      } catch (error) {
        results.push({ configId: config.id, error: String(error) });
      }
    }

    return NextResponse.json({ results });
  }

  // User-triggered path
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const digestConfigId = body.digestConfigId as string | undefined;

  try {
    const digestId = await generateDigest(user.id, "on_demand", digestConfigId);
    return NextResponse.json({ digestId, status: "processing" });
  } catch (error) {
    return NextResponse.json({ error: `Generation failed: ${error}` }, { status: 500 });
  }
}
