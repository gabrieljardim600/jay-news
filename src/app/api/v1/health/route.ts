import { withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const GET = withService(async (_req, ctx) => {
  return NextResponse.json({
    ok: true,
    service: ctx.service.slug,
    account_id: ctx.account_id,
    user_id: ctx.user_id,
    role: ctx.role,
    scopes: ctx.service.scopes,
    rate_limit_per_min: ctx.service.rate_limit_per_min,
  });
});
