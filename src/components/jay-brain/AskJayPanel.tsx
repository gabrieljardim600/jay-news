"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import type { AskJayScope } from "@/types";

interface AskJayPanelProps {
  open: boolean;
  onClose: () => void;
  scope: AskJayScope;
}

interface UITurn {
  role: "user" | "assistant";
  content: string;
}

export function AskJayPanel({ open, onClose, scope }: AskJayPanelProps) {
  const [turns, setTurns] = useState<UITurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Mutable refs that always reflect the latest values, so async work
  // (setTimeout, fetch handlers) reads current state instead of stale closures.
  const sessionIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastScopeKey = useRef<string>("");

  // Keep streamingRef in sync
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streamingRef.current) return;

    setTurns((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/jay-brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message: trimmed,
          scope: {
            type: scope.type,
            id: scope.id,
            article: scope.article,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `[Erro ${res.status}] ${errText.slice(0, 300)}` };
          return next;
        });
        return;
      }

      const sid = res.headers.get("X-Session-Id");
      if (sid) sessionIdRef.current = sid;

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
      // Flush
      const tail = decoder.decode();
      if (tail) {
        acc += tail;
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== "AbortError") {
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `[Erro de rede] ${e.message}` };
          return next;
        });
      }
    } finally {
      streamingRef.current = false;
      setStreaming(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [scope]);

  // Reset + auto-send when the panel opens with a new scope OR a new
  // preloadedMessage (e.g. clicking a different quick action on the same article).
  useEffect(() => {
    if (!open) return;

    // Include preloadedMessage in the key so a different quick action on the
    // same article still triggers a fresh session and auto-send.
    const key = `${scope.type}|${scope.id ?? ""}|${scope.article?.id ?? ""}|${scope.preloadedMessage ?? ""}`;
    const isNewScope = key !== lastScopeKey.current;

    if (isNewScope) {
      // Abort any in-flight stream from the previous scope.
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      lastScopeKey.current = key;
      sessionIdRef.current = null;
      streamingRef.current = false;
      setTurns([]);
      setStreaming(false);
      setInput("");
    }

    if (scope.preloadedMessage && isNewScope) {
      const msg = scope.preloadedMessage;
      const t = setTimeout(() => sendMessage(msg), 30);
      return () => clearTimeout(t);
    } else if (!scope.preloadedMessage) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, scope.type, scope.id, scope.article?.id, scope.preloadedMessage, sendMessage]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Autoscroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (!open) return null;

  const headerSubtitle =
    scope.type === "article" && scope.article
      ? scope.article.title.slice(0, 60) + (scope.article.title.length > 60 ? "…" : "")
      : scope.type === "digest"
      ? "Sobre o digest atual"
      : scope.type === "watchlist"
      ? "Sobre sua watchlist"
      : "Pergunta livre";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <aside className="w-full max-w-[480px] h-full bg-card-solid border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight">Ask Jay</h2>
              <p className="text-[11px] text-text-muted truncate leading-tight">{headerSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {turns.length === 0 && (
            <div className="text-center py-10 text-text-muted text-[13px]">
              <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Pergunte qualquer coisa sobre essa notícia, seu digest ou sua watchlist.
            </div>
          )}
          {turns.map((turn, i) => (
            <ChatTurn
              key={i}
              role={turn.role}
              content={turn.content}
              pending={streaming && i === turns.length - 1 && turn.role === "assistant" && turn.content.length === 0}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao Jay..."
              rows={1}
              className="flex-1 resize-none bg-surface rounded-[12px] px-3.5 py-2.5 text-[14px] text-text placeholder-text-muted outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={streaming || input.trim().length === 0}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ChatTurn({ role, content, pending }: { role: "user" | "assistant"; content: string; pending: boolean }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[14px] bg-primary text-white px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-[14px] bg-surface text-text px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
        {pending ? <PendingDots /> : content}
      </div>
    </div>
  );
}

function PendingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
