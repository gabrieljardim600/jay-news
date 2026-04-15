export type ResearchCompetitor = {
  id: string;
  name: string;
  website: string | null;
  aliases: string[];
  cnpj?: string | null;
};

export type ResearchMarket = {
  id: string;
  name: string;
  description: string | null;
  language: string;
};

/** A provider's output — one chunk of text for the prompt + optional structured
 * hints that the post-processor can merge into the final briefing JSON. */
export type ResearchBlock = {
  providerId: string;
  /** Title shown in the prompt before the block, e.g. "CVM — Composição da Diretoria". */
  label: string;
  /** Markdown/text body to feed the LLM. */
  text: string;
  /** Optional structured hints that skip the LLM step for known-shape data. */
  hints?: {
    cnpj?: string;
    razao_social?: string;
    logo_url?: string;
    colors?: string[];
    ticker?: string;
    lideranca?: string[];
    processos_count?: number;
    reclame_aqui?: { score?: number; total?: number; resolved_pct?: number };
    glassdoor?: { score?: number; total?: number };
    meta_ads_active?: number;
    play_store?: { rating?: number; reviews?: number };
    app_store?: { rating?: number; reviews?: number };
  };
};

export type ResearchProvider = {
  id: string;
  /** Readable label for logs + UI. */
  label: string;
  /** Optional: short user-facing description of what this provider brings. */
  description?: string;
  /** Whether this provider is enabled for the given competitor/market. */
  enabled: (competitor: ResearchCompetitor, market: ResearchMarket) => boolean;
  /** Fetch and return a ResearchBlock, or null when no data. Must not throw. */
  fetch: (competitor: ResearchCompetitor, market: ResearchMarket) => Promise<ResearchBlock | null>;
};

export type EntityField = "name" | "website" | "cnpj" | "ticker" | "aliases";

export type ResearchModule = {
  id: string;
  label: string;
  description: string;
  /** UI icon name (lucide) */
  icon?: string;
  /** When true, this module is always on regardless of user selection. */
  always_on?: boolean;
  /** Fields needed for the module's providers to run meaningfully. */
  required_fields?: EntityField[];
  /** Fields that improve coverage but are not strictly required. */
  optional_fields?: EntityField[];
  providers: ResearchProvider[];
};
