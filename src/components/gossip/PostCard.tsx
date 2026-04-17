"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, MoreVertical } from "lucide-react";
import type { GossipPost, GossipSourceTier, GossipPlatform, GossipTopic } from "@/lib/gossip/types";

export interface FeedPostItem {
  post: GossipPost;
  source: {
    label: string;
    tier: GossipSourceTier;
    platform: GossipPlatform;
  };
  matched_topics: Array<{
    topic_id: string;
    name: string;
    matched_by: string;
  }>;
}

interface PostCardProps {
  item: FeedPostItem;
  topics: GossipTopic[];
  onTag?: (action: "confirm" | "reject", topicId: string, postId: string) => void;
}

function shortRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}sem`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function tierBadgeClasses(tier: GossipSourceTier): string {
  if (tier === "proxy") return "bg-blue-500/10 text-blue-500";
  if (tier === "aggregator") return "bg-purple-500/10 text-purple-500";
  return "bg-surface text-text-secondary";
}

function truncateBody(body: string, max = 200): string {
  if (body.length <= max) return body;
  return body.slice(0, max).trimEnd() + "…";
}

export function PostCard({ item, topics, onTag }: PostCardProps) {
  const { post, source, matched_topics } = item;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const title = post.title?.trim();
  const body = post.body?.trim();

  return (
    <article className="py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-[10px] overflow-hidden bg-surface shrink-0 relative">
          {post.image_url ? (
            <Image
              src={post.image_url}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium uppercase tracking-wide ${tierBadgeClasses(
                source.tier
              )}`}
            >
              {source.label || source.platform}
            </span>
            {post.author && (
              <span className="text-[11px] text-text-muted truncate">{post.author}</span>
            )}
            <span className="text-text-muted text-[11px]">·</span>
            <span className="text-[11px] text-text-muted">{shortRelative(post.published_at)}</span>
          </div>

          {title && (
            <h3 className="text-[15px] font-semibold text-text leading-snug mb-1">{title}</h3>
          )}

          {body && (
            <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
              {truncateBody(body)}
            </p>
          )}

          {matched_topics.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {matched_topics.map((t) => (
                <span
                  key={t.topic_id}
                  className="inline-flex items-center h-5 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                  title={`Match via ${t.matched_by}`}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Abrir
            </a>

            <div className="ml-auto relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Mais ações"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface text-text-muted hover:text-text transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-10 min-w-[220px] bg-card-solid border border-border rounded-[10px] shadow-lg py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-muted">
                    Marcar relacionado a…
                  </div>
                  {topics.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-text-muted">
                      Nenhum topic disponível
                    </div>
                  )}
                  {topics.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onTag?.("confirm", t.id, post.id);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface transition-colors"
                    >
                      {t.name}
                    </button>
                  ))}
                  {matched_topics.length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-text-muted border-t border-border mt-1">
                        Não é sobre…
                      </div>
                      {matched_topics.map((t) => (
                        <button
                          key={`reject-${t.topic_id}`}
                          onClick={() => {
                            onTag?.("reject", t.topic_id, post.id);
                            setMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-danger hover:bg-surface transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
