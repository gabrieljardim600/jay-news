"use client";

import { useCallback, useEffect, useState } from "react";
import { PostCard, type FeedPostItem } from "./PostCard";
import type { GossipTopic } from "@/lib/gossip/types";

interface FeedListProps {
  topicId?: string;
  sourceId?: string;
  refreshKey: number;
  topics: GossipTopic[];
  onTag?: (action: "confirm" | "reject", topicId: string, postId: string) => void;
}

export function FeedList({ topicId, sourceId, refreshKey, topics, onTag }: FeedListProps) {
  const [items, setItems] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (topicId) qs.set("topic_id", topicId);
      if (sourceId) qs.set("source_id", sourceId);
      const url = `/api/gossip/feed${qs.toString() ? `?${qs.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setItems(Array.isArray(json?.data) ? (json.data as FeedPostItem[]) : []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [topicId, sourceId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="flex flex-col">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-4 border-b border-border last:border-0">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-[10px] bg-surface-light animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-32 bg-surface-light animate-pulse rounded mb-2" />
                <div className="h-4 w-3/4 bg-surface-light animate-pulse rounded mb-2" />
                <div className="h-3 w-full bg-surface-light animate-pulse rounded mb-1" />
                <div className="h-3 w-5/6 bg-surface-light animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[13px] text-danger py-6">Erro ao carregar feed: {error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border p-6 bg-card-solid">
        <p className="text-[13px] text-text-muted">
          Coletando suas primeiras fofocas — clique Atualizar no topo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <PostCard key={item.post.id} item={item} topics={topics} onTag={onTag} />
      ))}
    </div>
  );
}
