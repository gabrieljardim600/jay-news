import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildContext } from "@/lib/jay-brain/context-builder";
import { streamChat, type ChatTurn } from "@/lib/jay-brain/chat";
import type { ChatContextType, ChatMessage as ChatMessageRow } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequestBody {
  sessionId?: string;
  message: string;
  scope: {
    type: ChatContextType;
    id?: string | null;
    article?: {
      id?: string;
      title: string;
      summary: string;
      full_content?: string | null;
      source_name: string;
      source_url: string;
      published_at?: string | null;
    };
  };
  language?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as ChatRequestBody;
  const { message, scope, language = "pt-BR" } = body;
  let { sessionId } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (!scope || !scope.type) {
    return NextResponse.json({ error: "Missing scope" }, { status: 400 });
  }

  // Resolve or create session
  if (sessionId) {
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (!session) sessionId = undefined;
  }

  if (!sessionId) {
    const title = message.slice(0, 80).trim() + (message.length > 80 ? "…" : "");
    const { data: created, error: createErr } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        title,
        context_type: scope.type,
        context_id: scope.id || null,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json({ error: createErr?.message || "Failed to create session" }, { status: 500 });
    }
    sessionId = created.id;
  }

  // Load prior turns for this session (excluding the message we're about to add)
  const { data: priorMessages } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(30);

  const history: ChatTurn[] = (priorMessages || []).map((m: Pick<ChatMessageRow, "role" | "content">) => ({
    role: m.role,
    content: m.content,
  }));

  // Persist the new user turn
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  // Log interaction
  await supabase.from("user_interactions").insert({
    user_id: user.id,
    action: "chat_query",
    target_type: scope.type === "article" ? "article" : null,
    target_id: scope.id || null,
    payload: { query: message },
  });

  // Build context
  const normalizedArticle = scope.article
    ? {
        id: scope.article.id,
        title: scope.article.title,
        summary: scope.article.summary,
        full_content: scope.article.full_content ?? null,
        source_name: scope.article.source_name,
        source_url: scope.article.source_url,
        published_at: scope.article.published_at ?? null,
      }
    : undefined;

  const context = await buildContext({
    supabase,
    userId: user.id,
    scope: {
      type: scope.type,
      id: scope.id,
      article: normalizedArticle,
    },
  });

  // Stream Claude response, accumulating to persist on close.
  // Use a single TextDecoder with stream:true so multibyte chars (ç, ã, é) that
  // span chunk boundaries don't get corrupted before we save them to the DB.
  let accumulated = "";
  const sourceStream = streamChat({ history, newUserMessage: message, context, language });
  const teedReader = sourceStream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await teedReader.read();
          if (done) break;
          if (value) {
            accumulated += decoder.decode(value, { stream: true });
            controller.enqueue(value);
          }
        }
        // Flush any remaining bytes
        accumulated += decoder.decode();
      } finally {
        controller.close();
        // Persist assistant turn (best-effort)
        if (accumulated.trim().length > 0) {
          await supabase.from("chat_messages").insert({
            session_id: sessionId!,
            role: "assistant",
            content: accumulated,
            metadata: { model: "claude-sonnet-4-6" },
          });
          await supabase
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionId!);
        }
      }
    },
  });

  // Send sessionId via header only (no inline prefix). Header is exposed to JS
  // because we set Access-Control-Expose-Headers — same-origin doesn't strictly
  // need it, but doing it explicitly is robust.
  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Session-Id": sessionId!,
      "X-Accel-Buffering": "no",
      "Access-Control-Expose-Headers": "X-Session-Id",
    },
  });
}
