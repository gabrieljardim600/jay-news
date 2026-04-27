import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

type ProgressMeta = {
  progress?: number;
  stage?: string;
  source_results?: unknown[];
};

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("digests")
    .select("id, status, metadata, generated_at")
    .eq("id", id);
  q = byAccount(q, ctx);
  const { data, error } = await q.maybeSingle();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  const meta = (data.metadata || {}) as ProgressMeta;
  return NextResponse.json({
    data: {
      digest_id: data.id,
      status: data.status,
      progress: typeof meta.progress === "number" ? meta.progress : null,
      stage: meta.stage ?? null,
      generated_at: data.generated_at,
    },
  });
});
