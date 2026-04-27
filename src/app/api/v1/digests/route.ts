import { accountClient, byAccount, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Cursor = { generated_at: string; id: string };

function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed.generated_at === "string" && typeof parsed.id === "string") {
      return parsed as Cursor;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf-8").toString("base64url");
}

export const GET = withService(async (req, ctx) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const digestConfigId = url.searchParams.get("digest_config_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const supabase = accountClient(ctx);
  let query = supabase
    .from("digests")
    .select("id, generated_at, type, status, summary, digest_config_id, metadata")
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  query = byAccount(query, ctx);

  if (digestConfigId) query = query.eq("digest_config_id", digestConfigId);
  if (from) query = query.gte("generated_at", from);
  if (to) query = query.lte("generated_at", to);

  if (cursor) {
    query = query.or(
      `generated_at.lt.${cursor.generated_at},and(generated_at.eq.${cursor.generated_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  const next_cursor =
    data && data.length === limit
      ? encodeCursor({
          generated_at: data[data.length - 1].generated_at,
          id: data[data.length - 1].id,
        })
      : null;

  return NextResponse.json({ data: data || [], next_cursor });
});
