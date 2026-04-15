import type { ResearchBlock, ResearchCompetitor, ResearchMarket, ResearchProvider } from "./types";
import { resolveModules } from "./modules";
import { entityKeyFor, getCached, setCached, ttlFor } from "./cache";
import { enrichAndFilter, type RelevanceOptions } from "./relevance";

export type ModuleRunResult = {
  moduleId: string;
  moduleLabel: string;
  blocks: ResearchBlock[];
};

export type RunResearchOptions = {
  moduleIds: string[];
  competitor: ResearchCompetitor;
  market: ResearchMarket;
  /** Upper bound per provider so a slow scraper can't stall the briefing. */
  providerTimeoutMs?: number;
  /** When true, bypass cache and force a fresh fetch. */
  forceRefresh?: boolean;
  /** Optional relevance filter applied post-fetch to search-like providers. */
  relevance?: RelevanceOptions;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export type ProviderRunMeta = {
  providerId: string;
  cached: boolean;
  ageSeconds?: number;
};

async function runProvider(
  provider: ResearchProvider,
  opts: RunResearchOptions,
  entityKey: string,
  timeoutMs: number,
): Promise<{ block: ResearchBlock | null; meta: ProviderRunMeta }> {
  const ttl = ttlFor(provider.id);

  if (!opts.forceRefresh && ttl > 0) {
    const cached = await getCached(provider.id, entityKey);
    if (cached) {
      const age = Math.floor((Date.now() - new Date(cached.fetched_at).getTime()) / 1000);
      return { block: cached.payload, meta: { providerId: provider.id, cached: true, ageSeconds: age } };
    }
  }

  const block = await withTimeout(
    provider.fetch(opts.competitor, opts.market).catch(() => null),
    timeoutMs,
  );

  // Store even null results to avoid hammering broken sources — but short TTL
  if (ttl > 0) {
    const effectiveTtl = block ? ttl : Math.min(ttl, 6 * 3600); // negative cache: 6h
    await setCached(provider.id, entityKey, block, effectiveTtl).catch(() => {});
  }

  return { block, meta: { providerId: provider.id, cached: false } };
}

export async function runResearch(opts: RunResearchOptions): Promise<ModuleRunResult[]> {
  const modules = resolveModules(opts.moduleIds);
  const timeout = opts.providerTimeoutMs ?? 12_000;
  const entityKey = entityKeyFor(opts.competitor);
  const results: ModuleRunResult[] = [];

  // Dedup providers across modules (some appear in multiple, e.g. CVM FRE)
  const seenProvider = new Map<string, { block: ResearchBlock | null; meta: ProviderRunMeta; searchLike: boolean }>();

  for (const mod of modules) {
    const enabled = mod.providers.filter((p) => {
      try { return p.enabled(opts.competitor, opts.market); } catch { return false; }
    });
    if (enabled.length === 0) continue;

    const resolved = await Promise.all(enabled.map(async (p) => {
      const existing = seenProvider.get(p.id);
      if (existing) return existing;
      const r = await runProvider(p, opts, entityKey, timeout);
      const withFlag = { ...r, searchLike: !!p.searchLike };
      seenProvider.set(p.id, withFlag);
      return withFlag;
    }));

    const blocks = resolved
      .map((r) => {
        if (!r.block) return null;
        if (opts.relevance) return enrichAndFilter(r.block, r.searchLike, opts.relevance);
        if (r.searchLike) return enrichAndFilter(r.block, true, { requireTerms: [], excludeTerms: [], strict: false });
        return enrichAndFilter(r.block, false, { requireTerms: [], excludeTerms: [], strict: false });
      })
      .filter((b): b is ResearchBlock => !!b);
    if (blocks.length > 0) {
      results.push({ moduleId: mod.id, moduleLabel: mod.label, blocks });
    }
  }

  const cachedCount = [...seenProvider.values()].filter((r) => r.meta.cached).length;
  const freshCount = seenProvider.size - cachedCount;
  console.log(`[research] ${entityKey} — ${cachedCount} cache hits, ${freshCount} live fetches (${seenProvider.size} providers total)`);

  return results;
}

/** Merge all hints from all blocks into a single object. Later blocks win. */
export function mergeHints(runs: ModuleRunResult[]) {
  const merged: NonNullable<ResearchBlock["hints"]> = {};
  for (const run of runs) {
    for (const b of run.blocks) {
      if (!b.hints) continue;
      Object.assign(merged, b.hints);
      if (b.hints.colors && merged.colors && merged.colors !== b.hints.colors) {
        const all = [...merged.colors, ...b.hints.colors];
        merged.colors = Array.from(new Set(all));
      }
    }
  }
  return merged;
}

export function renderForPrompt(runs: ModuleRunResult[]): string {
  const sections: string[] = [];
  for (const run of runs) {
    sections.push(`\n## MÓDULO: ${run.moduleLabel.toUpperCase()}\n`);
    for (const b of run.blocks) {
      sections.push(`### ${b.label}`);
      sections.push(b.text);
      sections.push("");
    }
  }
  return sections.join("\n").trim();
}
