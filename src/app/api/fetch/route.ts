import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAndStore } from "@/lib/sources/fetcher";

export const maxDuration = 60;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Clean up articles older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("fetched_articles").delete().lt("fetched_at", cutoff);

  // Fetch for all active digest configs
  const { data: configs } = await supabase
    .from("digest_configs")
    .select("id")
    .eq("is_active", true);

  if (!configs || configs.length === 0) {
    return NextResponse.json({ message: "No active configs", fetched: 0, configs: 0 });
  }

  const results = await Promise.allSettled(
    configs.map((c) => fetchAndStore(c.id, supabase))
  );

  const totalFetched = results.reduce(
    (sum, r) => sum + (r.status === "fulfilled" ? r.value.fetched : 0),
    0
  );
  const totalStored = results.reduce(
    (sum, r) => sum + (r.status === "fulfilled" ? r.value.stored : 0),
    0
  );
  const errors = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    configs: configs.length,
    fetched: totalFetched,
    stored: totalStored,
    errors,
  });
}
