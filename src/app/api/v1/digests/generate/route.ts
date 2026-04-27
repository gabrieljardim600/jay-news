import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { initializeDigest, runDigestPipeline } from "@/lib/digest/generator";
import { NextResponse } from "next/server";
import { after } from "next/server";

export const maxDuration = 300;

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) {
    throw new ServiceAuthError(400, "X-User-Id required for digest generation");
  }

  const body = await req.json().catch(() => ({}));
  const digestConfigId: string | undefined = body.digest_config_id || undefined;
  if (!digestConfigId) {
    return NextResponse.json(
      { error: { message: "digest_config_id is required" } },
      { status: 400 }
    );
  }

  // Validate config belongs to this account
  const supabase = accountClient(ctx);
  let q = supabase.from("digest_configs").select("id").eq("id", digestConfigId);
  q = byAccount(q, ctx);
  const { data: cfg, error: cfgErr } = await q.maybeSingle();
  if (cfgErr) {
    return NextResponse.json({ error: { message: cfgErr.message } }, { status: 500 });
  }
  if (!cfg) {
    return NextResponse.json(
      { error: { message: "digest_config not found in this account" } },
      { status: 404 }
    );
  }

  // Initialize: creates digest row immediately so client can poll
  const init = await initializeDigest(
    ctx.user_id,
    "on_demand",
    digestConfigId,
    ctx.account_id
  );

  // Async pipeline via Next.js after()
  after(async () => {
    try {
      await runDigestPipeline(
        init.digestId,
        ctx.user_id!,
        digestConfigId,
        init.settings,
        init.topics,
        init.sources,
        init.alerts,
        init.exclusions,
        ctx.account_id
      );
    } catch (err) {
      console.error(`[v1/digests/generate] pipeline failed for ${init.digestId}:`, err);
    }
  });

  return NextResponse.json({
    data: { digest_id: init.digestId, status: "queued" },
  });
});
