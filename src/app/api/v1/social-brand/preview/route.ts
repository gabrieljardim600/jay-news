// Preview do profile de uma marca antes de criar o target.
// Permite o wizard mostrar foto/bio/followers pro user confirmar antes de salvar.
import { fetchInstagramProfile } from "@/lib/social-brand/instagram";
import { fetchFacebookPage } from "@/lib/social-brand/facebook-page";
import { withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID = new Set(["instagram", "facebook_page"]);

export const POST = withService(async (req) => {
  const body = await req.json().catch(() => ({}));
  const platform = String(body?.platform || "").trim();
  const identifier = String(body?.identifier || "")
    .trim()
    .replace(/^@/, "");

  if (!platform || !identifier) {
    return NextResponse.json(
      { error: { message: "platform e identifier obrigatórios" } },
      { status: 400 },
    );
  }
  if (!VALID.has(platform)) {
    return NextResponse.json(
      { error: { message: `preview não suportado pra ${platform}` } },
      { status: 400 },
    );
  }

  try {
    if (platform === "instagram") {
      const r = await fetchInstagramProfile(identifier);
      return NextResponse.json({
        data: {
          platform,
          identifier,
          profile: r.profile,
          posts_sample: r.posts.slice(0, 3).map((p) => ({
            external_id: p.external_id,
            kind: p.kind,
            caption: (p.caption ?? "").slice(0, 140),
            permalink: p.permalink,
            posted_at: p.posted_at,
            thumbnail: p.media[0]?.thumbnail_url ?? p.media[0]?.url ?? null,
          })),
          posts_count: r.posts.length,
        },
      });
    }
    if (platform === "facebook_page") {
      const r = await fetchFacebookPage(identifier);
      return NextResponse.json({
        data: {
          platform,
          identifier,
          profile: r.profile,
          posts_sample: r.posts.slice(0, 3).map((p) => ({
            external_id: p.external_id,
            kind: p.kind,
            caption: (p.caption ?? "").slice(0, 140),
            permalink: p.permalink,
            posted_at: p.posted_at,
            thumbnail: p.media[0]?.thumbnail_url ?? p.media[0]?.url ?? null,
          })),
          posts_count: r.posts.length,
        },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: { message: msg } }, { status: 422 });
  }
  return NextResponse.json({ error: { message: "platform inválida" } }, { status: 400 });
});
