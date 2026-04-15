import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json-extract";
import { NextResponse } from "next/server";

type Suggestion = { name: string; url: string; source_type?: "rss" | "web" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const marketName = String(body.marketName || "").trim();
  const subtopics: string[] = Array.isArray(body.subtopics) ? body.subtopics.map(String) : [];
  const language = String(body.language || "pt-BR");
  if (!marketName) return NextResponse.json({ error: "Missing marketName" }, { status: 400 });

  const isPt = language === "pt-BR";
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Sugira 8 fontes de notícias (sites especializados) para cobrir o mercado abaixo.

Mercado: "${marketName}"
${subtopics.length ? `Sub-tópicos de foco: ${subtopics.join(", ")}` : ""}
${isPt ? "Priorize fontes brasileiras ou em português." : "English sources preferred."}

Prioridades:
- Sites com conteúdo editorial (não blogs corporativos)
- Cobertura frequente do tema
- Mix de veículos consagrados + especializados no nicho
- Se souber a URL do feed RSS, use source_type="rss"; caso contrário "web"

Retorne APENAS um JSON array no formato:
[{"name": "Nome do site", "url": "https://dominio.com/feed", "source_type": "rss"}]

Sem markdown, sem explicação.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: Suggestion[] = [];
    try {
      parsed = extractJson<Suggestion[]>(text);
    } catch (parseErr) {
      console.error("suggest-sources JSON parse failed:", parseErr, "\ntext:", text.slice(0, 500));
      return NextResponse.json({ suggestions: [], error: "Falha ao interpretar resposta da IA" }, { status: 502 });
    }
    if (!Array.isArray(parsed)) return NextResponse.json({ suggestions: [] });

    const suggestions = parsed
      .filter((s) => s && typeof s.name === "string" && typeof s.url === "string" && s.name.trim() && s.url.trim())
      .slice(0, 10)
      .map((s) => ({
        name: s.name.trim(),
        url: s.url.trim(),
        source_type: s.source_type === "rss" ? "rss" : "web",
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Source suggestion failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
