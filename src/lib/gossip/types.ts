export type GossipPlatform = "rss" | "twitter" | "youtube" | "reddit";
export type GossipSourceTier = "primary" | "proxy" | "aggregator";
export type GossipTopicType = "person" | "couple" | "event" | "show" | "brand";
export type MatchedBy = "alias" | "claude" | "manual" | "manual_negative";
export type SpikeLevel = "low" | "medium" | "high";

export interface GossipSource {
  id: string;
  user_id: string;
  platform: GossipPlatform;
  handle: string;
  label: string;
  tier: GossipSourceTier;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GossipPost {
  id: string;
  user_id: string;
  source_id: string;
  platform: GossipPlatform;
  external_id: string;
  url: string;
  author: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  published_at: string;
  raw: unknown;
  created_at: string;
}

export interface GossipTopic {
  id: string;
  user_id: string;
  type: GossipTopicType;
  name: string;
  aliases: string[];
  image_url: string | null;
  priority: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GossipPostTopic {
  post_id: string;
  topic_id: string;
  confidence: number;
  matched_by: MatchedBy;
  created_at: string;
}

export interface DossierQuote {
  text: string;
  source_label: string;
  url: string;
}

export interface GossipDossier {
  id: string;
  user_id: string;
  topic_id: string;
  date: string;
  summary: string;
  key_quotes: DossierQuote[];
  spike_score: number;
  spike_level: SpikeLevel;
  post_ids: string[];
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  created_at: string;
}

export interface GossipPostInput {
  source_id: string;
  platform: GossipPlatform;
  external_id: string;
  url: string;
  author: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  published_at: string;
  raw: unknown;
}
