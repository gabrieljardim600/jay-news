import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

export const DELETE = withService<unknown, Params>(async (_req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("gossip_sources")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  q = byAccount(q, ctx);
  const { error } = await q;

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
