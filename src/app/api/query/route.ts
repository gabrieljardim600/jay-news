import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runResearch, mergeHints } from "@/lib/markets/research/runner";
import type { ResearchCompetitor, ResearchMarket } from "@/lib/markets/research/types";

export const maxDuration = 300;

type QueryBody = {
  moduleIds?: string[];
  entity?: {
    name?: string;
    website?: string | null;
    cnpj?: string | null;
    ticker?: string | null;
    aliases?: string[];
  };
  excludeTerms?: string[];
  strictMatch?: boolean;
  forceRefresh?: boolean;
};

function sanitizeCnpj(v?: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function sanitizeWebsite(v?: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: QueryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.entity?.name?.trim();
  if (!name) return NextResponse.json({ error: "entity.name is required" }, { status: 400 });

  const moduleIds = Array.isArray(body.moduleIds) ? body.moduleIds.filter((s) => typeof s === "string") : [];

  const competitor: ResearchCompetitor = {
    id: `query-${Date.now()}`,
    name,
    website: sanitizeWebsite(body.entity?.website),
    aliases: Array.isArray(body.entity?.aliases) ? body.entity!.aliases!.filter(Boolean) : [],
    cnpj: sanitizeCnpj(body.entity?.cnpj),
  };

  const ticker = body.entity?.ticker?.trim();
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
    ? body.excludeTerms.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const domainAllow = host ? [host] : [];

  const startedAt = Date.now();
  try {
    const runs = await runResearch({
      moduleIds,
      competitor,
      market,
      forceRefresh: !!body.forceRefresh,
      relevance: { requireTerms, excludeTerms, domainAllow, strict },
    });
    const hints = mergeHints(runs);
    return NextResponse.json({
      entity: { name, website: competitor.website, cnpj: competitor.cnpj, ticker: ticker || null },
      relevance: { requireTerms, excludeTerms, domainAllow, strict },
      modules: runs,
      hints,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[api/query] runResearch failed", err);
    return NextResponse.json({ error: "Research run failed" }, { status: 500 });
  }
}
