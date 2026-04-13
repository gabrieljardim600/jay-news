import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { digestConfigId, interests } = body as {
    digestConfigId?: string;
    interests?: string[];
  };

  let topicDescriptions: string[] = [];
  let existingUrls: string[] = [];

  if (digestConfigId) {
    const [{ data: topics }, { data: sources }] = await Promise.all([
      supabase
        .from("topics")
        .select("name, keywords")
        .eq("digest_config_id", digestConfigId)
        .eq("is_active", true),
      supabase
        .from("rss_sources")
        .select("url")
        .eq("digest_config_id", digestConfigId)
        .eq("is_active", true),
    ]);
    topicDescriptions = (topics || []).map(
      (t) => `${t.name} (${(t.keywords as string[]).join(", ")})`
    );
    existingUrls = (sources || []).map((s) => s.url);
  } else if (interests && interests.length > 0) {
    topicDescriptions = interests;
  }

  if (topicDescriptions.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const prompt = `You are a news curator. The user follows these topics: ${topicDescriptions.join("; ")}.
They already have these RSS sources: ${existingUrls.length > 0 ? existingUrls.join(", ") : "none"}.
Suggest 5–8 new RSS feeds they are NOT already following.
Requirements:
- Real, actively maintained feeds
- Return the RSS/Atom feed URL directly (not the website homepage)
- Relevant to the listed topics
- Prioritize well-known, reliable sources

Return ONLY a JSON array (no explanation):
[{"name":"...","url":"...","description":"...","topic_name":"..."}]
"topic_name" should match one of the user's topics, or null if general.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ suggestions: [] });

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      name: string;
      url: string;
      description: string;
      topic_name: string | null;
    }>;
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
