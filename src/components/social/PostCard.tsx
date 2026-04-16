"use client";

import { ExternalLink, MessageSquare, ArrowUp, Sparkles, AtSign, PlaySquare } from "lucide-react";
import { relativeDate } from "@/lib/utils/relative-date";
import { useAskJay } from "@/context/AskJayContext";
import type { SocialPost } from "@/types";

interface PostCardProps {
  post: SocialPost;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "twitter") return <AtSign className={className} />;
  if (platform === "youtube") return <PlaySquare className={className} />;
  return <MessageSquare className={className} />;
}

export function PostCard({ post }: PostCardProps) {
  const askJay = useAskJay();
  const score = (post.metadata?.score as number | undefined) || 0;
  const comments = (post.metadata?.comments as number | undefined) || 0;
  const subreddit = post.metadata?.subreddit as string | undefined;

  function handleAskJay() {
    const preloaded = `Analisa esse post de ${post.author} (${post.platform}): "${post.title || post.content.slice(0, 200)}". O que isso significa, qual a relevância, e como conecta com meus interesses?`;
    askJay.open({
      type: "freeform",
      preloadedMessage: preloaded,
    });
  }

  return (
    <article className="py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0 text-text-muted">
          <PlatformIcon platform={post.platform} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[13px] font-semibold text-text">{post.author}</span>
            {subreddit && (
              <span className="text-[11px] text-text-muted">r/{subreddit}</span>
            )}
            {post.published_at && (
              <>
                <span className="text-text-muted text-[11px]">·</span>
                <span className="text-[11px] text-text-muted">{relativeDate(post.published_at)}</span>
              </>
            )}
          </div>

          {post.title && (
            <h3 className="text-[15px] font-semibold text-text leading-snug mb-1">{post.title}</h3>
          )}

          {post.content && (
            <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-4 whitespace-pre-line">
              {post.content}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {score > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <ArrowUp className="w-3 h-3" /> {formatNumber(score)}
              </span>
            )}
            {comments > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <MessageSquare className="w-3 h-3" /> {formatNumber(comments)}
              </span>
            )}
            <a
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Original
            </a>
            <button
              onClick={handleAskJay}
              className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface hover:bg-surface-light text-text-muted hover:text-text transition-colors text-[11px] font-medium"
            >
              <Sparkles className="w-3 h-3" /> Ask Jay
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
