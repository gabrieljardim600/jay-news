import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { runProfileBriefing } from "@/lib/markets/briefing-profiles/synth";
import { autoDiscoverEntity } from "@/lib/markets/research/auto-discover";
import type { ResearchCompetitor, ResearchMarket } from "@/lib/markets/research/types";
import { NextResponse } from "next/server";

export const maxDuration = 300;

function sanitizeCnpj(v?: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function sanitizeWebsite(v?: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required");

  const body = await req.json().catch(() => ({}));
  const profileId: string | undefined = body.profile_id || body.profileId;
  const entity = body.entity || {};
  if (!profileId || !entity?.name) {
    return NextResponse.json(
      { error: { message: "profile_id and entity.name are required" } },
      { status: 400 }
    );
  }

  const supabase = accountClient(ctx);
  // Profile precisa pertencer a essa account OU ser builtin
  let pq = supabase.from("briefing_profiles").select("*").eq("id", profileId);
  pq = pq.or(`account_id.eq.${ctx.account_id},is_builtin.eq.true`);
  const { data: profile, error: profErr } = await pq.maybeSingle();
  if (profErr) return NextResponse.json({ error: { message: profErr.message } }, { status: 500 });
  if (!profile) return NextResponse.json({ error: { message: "Profile not found" } }, { status: 404 });

  const name = String(entity.name).trim();
  const discovery = await autoDiscoverEntity({
    name,
    website: sanitizeWebsite(entity.website),
    cnpj: sanitizeCnpj(entity.cnpj),
  });

  const competitor: ResearchCompetitor = {
    id: `query-${Date.now()}`,
    name,
    website: discovery.website,
    aliases: Array.isArray(entity.aliases) ? entity.aliases.filter(Boolean) : [],
    cnpj: discovery.cnpj,
  };
  const ticker = entity.ticker?.trim();
  if (ticker) competitor.aliases = Array.from(new Set([...competitor.aliases, ticker]));

  const market: ResearchMarket = {
    id: "query-adhoc",
    name: "Consulta sob demanda",
    description: null,
    language: "pt-BR",
  };

  const host = (() => {
    if (!competitor.website) return null;
    try {
      return new URL(competitor.website).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  const strict = body.strict_match !== false && body.strictMatch !== false;
  const requireTerms = Array.from(
    new Set(
      [name, ...competitor.aliases, ...(host ? [host.split(".")[0]] : [])]
        .filter((s) => s && s.length >= 3)
    )
  );
  const excludeTerms = Array.isArray(body.exclude_terms || body.excludeTerms)
    ? (body.exclude_terms || body.excludeTerms).map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  try {
    const result = await runProfileBriefing({
      profile,
      competitor,
      market,
      forceRefresh: !!(body.force_refresh ?? body.forceRefresh),
      relevance: { requireTerms, excludeTerms, domainAllow: host ? [host] : [], strict },
    });
    const payload = { ...result, discovery: { discovered: discovery.discovered } };

    // Persiste no histórico
    supabase
      .from("query_runs")
      .insert({
        user_id: ctx.user_id,
        account_id: ctx.account_id,
        kind: "briefing",
        entity_name: name,
        entity: payload.entity,
        profile_id: profile.id,
        profile_slug: profile.slug,
        profile_label: profile.label,
        module_ids: profile.module_ids,
        result: payload,
        duration_ms: result.durationMs,
      })
      .then(({ error }) => {
        if (error) console.error("[v1 query_runs insert]", error);
      });

    return NextResponse.json({ data: payload });
  } catch (e) {
    console.error("[v1/query/briefing]", e);
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to generate briefing" } },
      { status: 500 }
    );
  }
});
