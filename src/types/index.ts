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
