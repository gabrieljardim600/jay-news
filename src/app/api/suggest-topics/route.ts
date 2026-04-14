import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  const language = (body.language as string | undefined) || "pt-BR";
  if (!name) return NextResponse.json({ error: "Missing digest name" }, { status: 400 });

  const isPt = language === "pt-BR";
  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Sugira 5 a 7 tópicos de notícias para um digest chamado "${name}".

Os tópicos devem ser:
- Abrangentes o suficiente para render notícias diárias (evite nichos muito estreitos)
- Diversos entre si, cobrindo ângulos diferentes do tema do digest
- Nomes curtos e claros (1–3 palavras)
- ${isPt ? "Em português" : "In English"}

Exemplo para "Trading":
["Day Trade", "Mercado Financeiro", "Criptomoedas", "Bolsa de Valores", "Análise Técnica", "Economia"]

Exemplo para "Tech":
["Inteligência Artificial", "Startups", "Big Tech", "Cibersegurança", "Hardware", "Programação"]

Retorne APENAS um JSON array de strings, sem explicação, sem markdown.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const topics: string[] = JSON.parse(jsonText);

    if (!Array.isArray(topics)) {
      return NextResponse.json({ topics: [] });
    }

    return NextResponse.json({ topics: topics.slice(0, 7) });
  } catch (err) {
    console.error("Topic suggestion failed:", err);
    return NextResponse.json({ topics: [] });
  }
}
