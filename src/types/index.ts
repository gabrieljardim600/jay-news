export interface UserSettings {
  user_id: string;
  digest_time: string;
  language: string;
  summary_style: "executive" | "detailed" | "complete";
  max_articles: number;
  created_at: string;
  updated_at: string;
}

export interface DigestConfig {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  language: string;
  summary_style: "executive" | "detailed" | "complete";
  digest_time: string;
  max_articles: number;
  is_active: boolean;
  digest_type: "standard" | "trends";
  trend_topic: string | null;
  trend_keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SourceTestResult {
  status: "success" | "error";
  feed_name?: string;
  total_articles?: number;
  fetch_method?: "rss" | "tavily" | "scraper";
  sample_articles?: { title: string; published_at: string | null; url: string }[];
  error_code?: string;
  error_message?: string;
}

export interface Topic {
  id: string;
  user_id: string;
  digest_config_id: string;
  name: string;
  keywords: string[];
  priority: "high" | "medium" | "low";
  is_active: boolean;
  created_at: string;
}

export interface RssSource {
  id: string;
  user_id: string;
  digest_config_id: string;
  name: string;
  url: string;
  source_type: "rss" | "web";
  topic_id: string | null;
  weight: number;
  is_active: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  digest_config_id: string;
  title: string;
  query: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Exclusion {
  id: string;
  user_id: string;
  digest_config_id: string;
  keyword: string;
  is_active: boolean;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  digest_config_id: string | null;
  generated_at: string;
  type: "scheduled" | "on_demand";
  status: "processing" | "completed" | "failed";
  summary: string | null;
  metadata: DigestMetadata;
}

export interface Article {
  id: string;
  digest_id: string;
  topic_id: string | null;
  alert_id: string | null;
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  key_quote: string | null;
  full_content: string | null;
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface RawArticle {
  title: string;
  url: string;
  content: string;       // Short snippet or AI summary — used for display/preview
  full_content?: string; // Complete original text — used for AI processing
  source_name: string;
  image_url?: string;
  published_at?: string;
}

export interface ProcessedArticle {
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  key_quote: string | null;
  full_content: string | null;
  topic_id: string | null;
  alert_id: string | null;
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
}

export interface TrendItem {
  title: string;
  description: string;
  days_active: number;
  article_count: number;
}

export interface SourceResult {
  name: string;
  type: string;
  status: "ok" | "error" | "empty";
  count: number;
  error?: string;
}

export interface DigestMetadata {
  total_articles?: number;
  sources_count?: number;
  topics_count?: number;
  trends?: TrendItem[];
  error?: string;
  progress?: number;
  stage?: string;
  source_results?: SourceResult[];
}

export interface DigestWithArticles extends Digest {
  articles: Article[];
  highlights: Article[];
  by_topic: Record<string, Article[]>;
  alert_articles: Article[];
}

// ─── Jay Brain ───────────────────────────────────────────────────────────────

export type WatchlistKind = "asset" | "theme" | "person" | "company";

export interface WatchlistItem {
  id: string;
  user_id: string;
  kind: WatchlistKind;
  label: string;
  keywords: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export type InteractionAction =
  | "read"
  | "expand"
  | "quick_action"
  | "chat_query"
  | "pulled_more"
  | "dismissed";

export type InteractionTargetType = "article" | "digest" | "watchlist_item" | "topic";

export interface UserInteraction {
  id: string;
  user_id: string;
  action: InteractionAction;
  target_type: InteractionTargetType | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export type ChatContextType = "digest" | "article" | "watchlist" | "freeform";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  context_type: ChatContextType | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type QuickActionVariant = "deepen" | "impact" | "history";

// ─── Social sources (Phase 2) ────────────────────────────────────────────────

export type VoicePlatform = "twitter" | "youtube" | "reddit_user";
export type CrowdPlatform = "reddit" | "stocktwits";
export type VoiceCategory = "analyst" | "economist" | "trader" | "institution" | "other";

export interface SocialVoice {
  id: string;
  user_id: string;
  platform: VoicePlatform;
  handle: string;
  label: string;
  category: VoiceCategory;
  is_active: boolean;
  created_at: string;
}

export interface CrowdSource {
  id: string;
  user_id: string;
  platform: CrowdPlatform;
  identifier: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  voice_id: string | null;
  crowd_source_id: string | null;
  platform: string;
  external_id: string;
  author: string;
  title: string | null;
  content: string;
  source_url: string;
  image_url: string | null;
  published_at: string | null;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

export interface AskJayScope {
  type: ChatContextType;
  id?: string | null;
  /** Optional inline article payload — used when scope is "article" and we already have it client-side */
  article?: Pick<Article, "id" | "title" | "summary" | "full_content" | "source_name" | "source_url" | "published_at">;
  /** Pre-loaded message to send on open (e.g. from a quick action) */
  preloadedMessage?: string;
}
