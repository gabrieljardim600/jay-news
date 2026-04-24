import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { initializeDigest, runDigestPipeline, generateDigest } from "@/lib/digest/generator";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  // Cron path: generate for all configs scheduled for the current hour (synchronous)
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
      .eq("auto_generate", true)
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

  // User-triggered path: create record and return digestId immediately, run pipeline in background
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const digestConfigId = body.digestConfigId as string | undefined;

  try {
    // Initialize: loads config + creates DB record. Returns immediately with digestId.
    const { digestId, settings, topics, sources, alerts, exclusions } = await initializeDigest(
      user.id,
      "on_demand",
      digestConfigId
    );

    // Run the heavy pipeline AFTER the response is sent, keeping the function alive.
    after(() =>
      runDigestPipeline(digestId, user.id, digestConfigId, settings, topics, sources, alerts, exclusions)
    );

    return NextResponse.json({ digestId, status: "processing" });
  } catch (error) {
    return NextResponse.json({ error: `Initialization failed: ${error}` }, { status: 500 });
  }
}
