import { NextResponse } from "next/server";
import { generateTradingBrief } from "@/lib/trading/generator";
import type { TradingEdition } from "@/lib/trading/types";

export const maxDuration = 300;

/**
 * GET/POST /api/cron/trading-global?edition=morning|closing
 *
 * Auth: header Authorization: Bearer ${CRON_SECRET}.
 *
 * Generates the global trading brief by impersonating TRADING_GLOBAL_USER_ID.
 * Consumed via /api/public/trading by external integrations (whitelabel-v1).
 *
 * Schedule (vercel.json):
 *   - morning: 30 9 * * 1-5  (BRT pre-open)
 *   - closing: 0 21 * * 1-5  (BRT post-close)
 */
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

  const globalUserId = process.env.TRADING_GLOBAL_USER_ID;
  if (!globalUserId) {
    return NextResponse.json(
      { error: "TRADING_GLOBAL_USER_ID not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const edition: TradingEdition =
    searchParams.get("edition") === "closing" ? "closing" : "morning";

  try {
    const result = await generateTradingBrief(globalUserId, edition);
    return NextResponse.json({ ok: true, edition, brief_id: result.briefId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    console.error("[cron/trading-global] failed:", message);
    return NextResponse.json({ ok: false, edition, error: message }, { status: 500 });
  }
}
