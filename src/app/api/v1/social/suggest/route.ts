import { requireRole, withService } from "@/lib/api/service-auth";
import { suggestUnifiedForNiche } from "@/lib/social/niche-suggester-unified";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  const body = await req.json().catch(() => ({}));
  const niche = String(body?.niche || "").trim();
  if (!niche) {
    return NextResponse.json({ error: { message: "niche obrigatório" } }, { status: 400 });
  }

  const result = await suggestUnifiedForNiche(niche);
  return NextResponse.json({ data: result });
});
