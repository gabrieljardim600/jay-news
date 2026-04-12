export interface UserSettings {
  user_id: string;
  digest_time: string;
  language: string;
  summary_style: "executive" | "detailed";
  max_articles: number;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  priority: "high" | "medium" | "low";
  is_active: boolean;
  created_at: string;
}

export interface RssSource {
  id: string;
  user_id: string;
  name: string;
  url: string;
  topic_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  title: string;
  query: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Exclusion {
  id: string;
  user_id: string;
  keyword: string;
  is_active: boolean;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  generated_at: string;
  type: "scheduled" | "on_demand";
  status: "processing" | "completed" | "failed";
  summary: string | null;
  metadata: Record<string, unknown>;
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
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface RawArticle {
  title: string;
  url: string;
  content: string;
  source_name: string;
  image_url?: string;
  published_at?: string;
}

export interface ProcessedArticle {
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  topic_id: string | null;
  alert_id: string | null;
  relevance_score: number;
  is_highlight: boolean;
  image_url: string | null;
  published_at: string | null;
}

export interface DigestWithArticles extends Digest {
  articles: Article[];
  highlights: Article[];
  by_topic: Record<string, Article[]>;
  alert_articles: Article[];
}
