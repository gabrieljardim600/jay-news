import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runMarketCollection } from "@/lib/markets/service";

export const maxDuration = 300;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function runAll(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: markets } = await supabase
    .from("markets")
    .select("id")
    .eq("is_active", true);

  if (!markets || markets.length === 0) {
    return NextResponse.json({ message: "No active markets", processed: 0 });
  }

  const settled = await Promise.allSettled(markets.map((m) => runMarketCollection(m.id)));
  const ok = settled.filter((s) => s.status === "fulfilled").length;
  const failed = settled.length - ok;
  const totalNew = settled.reduce((sum, s) => sum + (s.status === "fulfilled" ? s.value.articlesNew : 0), 0);

  return NextResponse.json({ processed: settled.length, ok, failed, totalNew });
}

export async function GET(request: Request) { return runAll(request); }
export async function POST(request: Request) { return runAll(request); }
