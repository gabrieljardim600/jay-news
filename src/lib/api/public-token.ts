import { NextResponse } from "next/server";

/**
 * Validates X-API-Key header against WL_API_TOKENS env (CSV of valid tokens).
 *
 * Used by /api/public/* routes that serve external consumers (whitelabel-v1, etc.).
 * Separate from /api/v1/ which uses news_services + bcrypt — public/* is read-only,
 * scope-less, and consumed by integrations that don't need per-account isolation.
 *
 * Returns NextResponse 401 if invalid; null if valid.
 */
export function checkPublicToken(req: Request): NextResponse | null {
  const provided = req.headers.get("x-api-key");
  if (!provided) {
    return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const raw = process.env.WL_API_TOKENS || "";
  const valid = raw.split(",").map((t) => t.trim()).filter(Boolean);
  if (valid.length === 0) {
    return NextResponse.json({ error: "Public API not configured" }, { status: 503 });
  }

  if (!valid.includes(provided)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return null;
}
