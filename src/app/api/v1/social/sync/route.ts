// POST /api/v1/social/sync
//
// Endpoint M2M pra trigger manual da coleta de voices/crowd da account.
// Usado pelo botao "Atualizar agora" do jay-social.
//
// Headers: X-Service-Key, X-Service, X-Account-Id, X-User-Id (opcional)
// Body: vazio
// Returns: { data: { reports, voicesProcessed, crowdProcessed, postsUpserted } }

import {
  accountClient,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { collectForAccount } from "@/lib/social/collector";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = withService(async (_req, ctx) => {
  requireRole(ctx, "editor");

  const supabase = accountClient(ctx);
  const result = await collectForAccount(supabase, ctx.account_id);

  return NextResponse.json({ data: result });
});
