import { createClient as createSupabase } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";
import { collectTradingData } from "./collector";
import { buildMorningPrompt, buildClosingPrompt } from "./prompt";
import type { TradingEdition } from "./types";

const MODEL = "claude-sonnet-4-6";

function service() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function generateTradingBrief(
  userId: string,
  edition: TradingEdition,
  date?: string,
): Promise<{ briefId: string }> {
  const svc = service();
  const d = date ?? todayBRT();

  const { data: row, error: insErr } = await svc
    .from("trading_briefs")
    .upsert(
      { user_id: userId, edition, date: d, status: "processing", model_used: MODEL },
      { onConflict: "user_id,edition,date" },
    )
    .select("id")
    .single();
  if (insErr || !row) throw new Error(insErr?.message || "Failed to create trading_briefs row");
  const briefId: string = row.id;

  const started = Date.now();
  try {
    const data = await collectTradingData(edition);

    const prompt = edition === "morning"
      ? buildMorningPrompt(data, d)
      : buildClosingPrompt(data, d);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = extractJson<Record<string, unknown>>(text);

    const update: Record<string, unknown> = {
      status: "completed",
      duration_ms: Date.now() - started,
      global_bullets: parsed.global_bullets ?? [],
      brasil_bullets: parsed.brasil_bullets ?? [],
      sentiment: {
        fear_greed: data.sentiment.fear_greed,
        fear_greed_label: data.sentiment.fear_greed_label,
        vix: data.sentiment.vix,
        put_call: data.sentiment.put_call,
        summary: typeof parsed.sentiment_summary === "string" ? parsed.sentiment_summary : "",
      },
    };

    if (edition === "morning") {
      update.agenda = parsed.agenda ?? [];
      update.take = typeof parsed.take === "string" ? parsed.take : "";
    } else {
      update.happened_bullets = parsed.happened_bullets ?? [];
      update.agenda_review = typeof parsed.agenda_review === "string" ? parsed.agenda_review : null;
      update.overnight = typeof parsed.overnight === "string" ? parsed.overnight : null;
      update.closing_take = typeof parsed.closing_take === "string" ? parsed.closing_take : "";
      update.agenda = [];
      update.take = null;
    }

    await svc.from("trading_briefs").update(update).eq("id", briefId);
    return { briefId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc.from("trading_briefs")
      .update({ status: "failed", error: msg, duration_ms: Date.now() - started })
      .eq("id", briefId);
    throw e;
  }
}
