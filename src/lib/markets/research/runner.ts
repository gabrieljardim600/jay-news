import type { ResearchBlock, ResearchCompetitor, ResearchMarket } from "./types";
import { resolveModules } from "./modules";

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
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function runResearch(opts: RunResearchOptions): Promise<ModuleRunResult[]> {
  const modules = resolveModules(opts.moduleIds);
  const timeout = opts.providerTimeoutMs ?? 12_000;
  const results: ModuleRunResult[] = [];

  for (const mod of modules) {
    const enabled = mod.providers.filter((p) => {
      try { return p.enabled(opts.competitor, opts.market); } catch { return false; }
    });
    if (enabled.length === 0) continue;

    const settled = await Promise.all(enabled.map((p) =>
      withTimeout(p.fetch(opts.competitor, opts.market).catch(() => null), timeout)
    ));
    const blocks = settled.filter((b): b is ResearchBlock => !!b);
    if (blocks.length > 0) {
      results.push({ moduleId: mod.id, moduleLabel: mod.label, blocks });
    }
  }
  return results;
}

/** Merge all hints from all blocks into a single object. Later blocks win. */
export function mergeHints(runs: ModuleRunResult[]) {
  const merged: NonNullable<ResearchBlock["hints"]> = {};
  for (const run of runs) {
    for (const b of run.blocks) {
      if (!b.hints) continue;
      Object.assign(merged, b.hints);
      // Special: merge colors as union
      if (b.hints.colors && merged.colors && merged.colors !== b.hints.colors) {
        const all = [...merged.colors, ...b.hints.colors];
        merged.colors = Array.from(new Set(all));
      }
    }
  }
  return merged;
}

/** Render the research runs into a single prompt-ready string with clear
 *  module/provider headers so the LLM knows the provenance of each fact. */
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
