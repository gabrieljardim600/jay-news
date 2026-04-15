import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/markets/briefing-profiles/service";
import { runProfileBriefing } from "@/lib/markets/briefing-profiles/synth";
import type { ResearchCompetitor, ResearchMarket } from "@/lib/markets/research/types";

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.profileId || !body.entity?.name) {
    return NextResponse.json({ error: "profileId e entity.name são obrigatórios" }, { status: 400 });
  }

  const profile = await getProfileById(supabase, user.id, body.profileId);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const name = String(body.entity.name).trim();
  const competitor: ResearchCompetitor = {
    id: `query-${Date.now()}`,
    name,
    website: sanitizeWebsite(body.entity.website),
    aliases: Array.isArray(body.entity.aliases) ? body.entity.aliases.filter(Boolean) : [],
    cnpj: sanitizeCnpj(body.entity.cnpj),
  };
  const ticker = body.entity.ticker?.trim();
  if (ticker) competitor.aliases = Array.from(new Set([...competitor.aliases, ticker]));

  const market: ResearchMarket = {
    id: "query-adhoc",
    name: "Consulta sob demanda",
    description: null,
    language: "pt-BR",
  };

  const host = (() => {
    if (!competitor.website) return null;
    try { return new URL(competitor.website).hostname.replace(/^www\./, ""); } catch { return null; }
  })();
  const strict = body.strictMatch !== false;
  const requireTerms = Array.from(new Set([
    name,
    ...competitor.aliases,
    ...(host ? [host.split(".")[0]] : []),
  ].filter((s) => s && s.length >= 3)));
  const excludeTerms = Array.isArray(body.excludeTerms)
    ? body.excludeTerms.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  try {
    const result = await runProfileBriefing({
      profile,
      competitor,
      market,
      forceRefresh: !!body.forceRefresh,
      relevance: { requireTerms, excludeTerms, domainAllow: host ? [host] : [], strict },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/query/briefing]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao gerar briefing" }, { status: 500 });
  }
}
