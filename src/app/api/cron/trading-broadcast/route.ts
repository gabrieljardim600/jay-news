import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { generateTradingBrief } from "@/lib/trading/generator";
import type { TradingEdition } from "@/lib/trading/types";

export const maxDuration = 300;

function service() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const edition: TradingEdition = searchParams.get("edition") === "closing" ? "closing" : "morning";

  const svc = service();
  // Find users who have at least one trading_briefs row (opted in).
  const { data: users } = await svc
    .from("trading_briefs")
    .select("user_id")
    .limit(500);
  const uniqueIds = [...new Set((users ?? []).map((r) => r.user_id as string))];

  if (uniqueIds.length === 0) {
    return NextResponse.json({ message: "No trading users found", edition });
  }

  const results = await Promise.allSettled(
    uniqueIds.map((uid) => generateTradingBrief(uid, edition)),
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - ok;

  return NextResponse.json({ edition, users: uniqueIds.length, ok, failed });
}
