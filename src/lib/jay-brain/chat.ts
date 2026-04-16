import { getAnthropicClient } from "@/lib/anthropic/client";
import { buildJaySystemPrompt, formatContextBlock, type BuiltContext } from "./prompts";
import type { ChatRole } from "@/types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

interface StreamChatArgs {
  history: ChatTurn[];      // prior turns (user/assistant), excluding the new user message
  newUserMessage: string;
  context: BuiltContext;
  language?: string;
}

/**
 * Streams Jay's response as Server-Sent Events-style text chunks.
 * Returns a ReadableStream of UTF-8 encoded text deltas.
 */
export function streamChat({ history, newUserMessage, context, language = "pt-BR" }: StreamChatArgs): ReadableStream<Uint8Array> {
  const client = getAnthropicClient();
  const system = buildJaySystemPrompt(language);
  const contextBlock = formatContextBlock(context);

  const userContent = contextBlock
    ? `${contextBlock}\n\n---\n\nUser message:\n${newUserMessage}`
    : newUserMessage;

  const messages = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: userContent },
  ];

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          stream: true,
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[ERRO: ${msg}]`));
        controller.close();
      }
    },
  });
}
