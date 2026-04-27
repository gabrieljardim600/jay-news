import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, slug, label, description, icon, module_ids, synth_prompt, output_sections, is_builtin, sort_order, created_at, updated_at`;

export const GET = withService(async (_req, ctx) => {
  const supabase = accountClient(ctx);
  // Builtin profiles devem aparecer pra todas as accounts; escopa via OR(account_id=mine, is_builtin=true)
  // Como service_role bypassa RLS e usamos byAccount(), precisamos de uma query manual.
  const { data: account, error: accErr } = await supabase
    .from("briefing_profiles")
    .select(SELECT_COLS)
    .eq("account_id", ctx.account_id)
    .order("sort_order", { ascending: true });
  if (accErr) return NextResponse.json({ error: { message: accErr.message } }, { status: 500 });

  const { data: builtins } = await supabase
    .from("briefing_profiles")
    .select(SELECT_COLS)
    .eq("is_builtin", true)
    .order("sort_order", { ascending: true });

  return NextResponse.json({
    data: {
      account: account || [],
      builtins: builtins || [],
    },
  });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required");

  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || "").trim();
  const label = String(body.label || "").trim();
  const synth_prompt = String(body.synth_prompt || "").trim();
  if (!slug || !label || !synth_prompt) {
    return NextResponse.json(
      { error: { message: "slug, label and synth_prompt are required" } },
      { status: 400 }
    );
  }

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("briefing_profiles")
    .insert({
      user_id: ctx.user_id,
      account_id: ctx.account_id,
      slug,
      label,
      description: body.description || null,
      icon: body.icon || null,
      module_ids: Array.isArray(body.module_ids) ? body.module_ids : [],
      synth_prompt,
      output_sections: Array.isArray(body.output_sections) ? body.output_sections : [],
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    })
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
