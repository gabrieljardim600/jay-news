import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { NextResponse } from "next/server";

type Suggestion = { name: string; website?: string; description?: string };

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
        content: `Sugira 10 empresas/players relevantes do mercado brasileiro para acompanhamento competitivo.

Mercado: "${marketName}"
${subtopics.length ? `Sub-tópicos de foco: ${subtopics.join(", ")}` : ""}

Prioridades:
- Empresas que atuam no Brasil (nacionais ou internacionais com presença BR)
- Mix de líderes consolidados + challengers/fintechs relevantes
- Evite empresas irrelevantes ou fora do nicho
- ${isPt ? "Em português" : "In English"}

Retorne APENAS um JSON array de objetos com a forma:
[{"name": "Nome da Empresa", "website": "https://dominio.com.br", "description": "1 linha explicando o que faz"}]

Sem markdown, sem explicação extra.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed: Suggestion[] = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) return NextResponse.json({ suggestions: [] });

    const suggestions = parsed
      .filter((s) => s && typeof s.name === "string" && s.name.trim())
      .slice(0, 12)
      .map((s) => ({
        name: s.name.trim(),
        website: typeof s.website === "string" ? s.website.trim() : "",
        description: typeof s.description === "string" ? s.description.trim() : "",
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Competitor suggestion failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
