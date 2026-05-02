import type { CollectedTradingData } from "./collector";
import { formatQuotesForPrompt } from "./quotes";

function formatCollectedData(data: CollectedTradingData): string {
  const parts: string[] = [];

  if (data.quotes.length > 0) {
    parts.push("== COTAÇÕES OFICIAIS (Yahoo Finance, valores reais) ==");
    parts.push(formatQuotesForPrompt(data.quotes));
    parts.push("\nUse estes números como fonte primária pro array `indicators`. Nunca contradiga estes valores com base nos dados de busca.");
  }

  if (data.marketBuckets.length > 0) {
    parts.push("\n== DADOS DE MERCADO (busca web — pra contexto e narrativa) ==");
    for (const b of data.marketBuckets) {
      parts.push(`\n--- ${b.label} (${b.global ? "Global" : "BR"}) ---`);
      for (const r of b.results) parts.push(`• ${r.title}\n  ${r.content}`);
    }
  }

  if (data.headlines.length > 0) {
    parts.push("\n== MANCHETES FINANCEIRAS (RSS) ==");
    for (const h of data.headlines.slice(0, 20)) {
      parts.push(`• [${h.source_name}${h.published_at ? ` · ${h.published_at.slice(0, 10)}` : ""}] ${h.title}`);
    }
  }

  if (data.agenda.length > 0) {
    parts.push("\n== AGENDA DETECTADA ==");
    for (const a of data.agenda) parts.push(`• ${a.event} (${a.impact}, ${a.region})`);
  }

  const s = data.sentiment;
  parts.push("\n== INDICADORES DE SENTIMENTO ==");
  parts.push(`Fear & Greed Index: ${s.fear_greed ?? "indisponível"}${s.fear_greed_label ? ` (${s.fear_greed_label})` : ""}`);
  parts.push(`VIX: ${s.vix ?? "indisponível"}`);
  parts.push(`Put/Call Ratio: ${s.put_call ?? "indisponível"}`);

  return parts.join("\n");
}

export function buildMorningPrompt(data: CollectedTradingData, date: string): string {
  return `Você é um analista de mercado sênior produzindo o briefing matinal para day traders de mini contratos (WINFUT / WDOFUT). O objetivo é preparar o trader para o pregão do dia. Seja factual, conciso e contextual.

Data do briefing: ${date}

${formatCollectedData(data)}

== FORMATO DE SAÍDA ==
Retorne APENAS JSON válido:

{
  "indicators": [
    {"name": "S&P 500", "value": "7.005,23", "change": "+0,8%", "direction": "up", "region": "EUA", "category": "indice"},
    {"name": "Nasdaq", "value": "25.987", "change": "+1,1%", "direction": "up", "region": "EUA", "category": "indice"},
    {"name": "Nikkei 225", "value": "42.150", "change": "+0,6%", "direction": "up", "region": "Global", "category": "indice"},
    {"name": "IBOVESPA", "value": "196.800", "change": "-0,3%", "direction": "down", "region": "BR", "category": "indice"},
    {"name": "Dólar (PTAX)", "value": "R$ 5,12", "change": "-0,5%", "direction": "down", "region": "BR", "category": "moeda"},
    {"name": "DXY", "value": "103,45", "change": "-0,2%", "direction": "down", "region": "EUA", "category": "moeda"},
    {"name": "Treasury 10y", "value": "4,32%", "change": "-2 bps", "direction": "down", "region": "EUA", "category": "juros"},
    {"name": "Petróleo WTI", "value": "US$ 101,20", "change": "-4,2%", "direction": "down", "region": "Global", "category": "commodity"},
    {"name": "Ouro", "value": "US$ 4.819", "change": "+0,6%", "direction": "up", "region": "Global", "category": "commodity"},
    {"name": "DI Jan/26", "value": "14,85%", "change": "+5 bps", "direction": "up", "region": "BR", "category": "juros"}
  ],
  "global_bullets": ["5-7 bullets curtos sobre cenário global: futuros EUA, Ásia, DXY, yield 10y, petróleo, ouro. Cada bullet: fato + variação %."],
  "brasil_bullets": ["3-5 bullets: IBOV futuro, câmbio, juros DI, notícia local relevante. Cada bullet: fato + contexto."],
  "agenda": [{"time": "09:00", "event": "Nome do evento", "impact": "alto ou medio", "region": "BR ou EUA ou Global"}],
  "sentiment_summary": "1 parágrafo analisando os indicadores de sentimento + contexto das notícias. Traduza os números em leitura prática pra quem vai operar.",
  "take": "1 parágrafo contextual: o que o cenário macro + agenda + sentimento sugere pro pregão de hoje. Interprete sem recomendar compra/venda. Viés implícito é OK."
}

O array "indicators" é OBRIGATÓRIO e deve conter 8-15 ativos. Extraia valores e variações reais dos dados acima. Categorias: indice, moeda, commodity, juros. Direction: up (positivo), down (negativo), flat (sem variação). Se um valor não estiver disponível, OMITA o indicador — nunca invente número.

Regras:
- Português do Brasil.
- Bullets começam com o ativo/tema em negrito implícito.
- Se um dado não estiver disponível, omita o bullet — nunca invente números.
- Na agenda, use o horário de Brasília.
- O "take" é a seção mais valiosa — seja específico e contextual, não genérico.`;
}

export function buildClosingPrompt(data: CollectedTradingData, date: string): string {
  return `Você é um analista de mercado sênior produzindo o briefing de fechamento para day traders de mini contratos (WINFUT / WDOFUT). O objetivo é revisar o pregão do dia e preparar o trader para o overnight.

Data do briefing: ${date}

${formatCollectedData(data)}

== FORMATO DE SAÍDA ==
Retorne APENAS JSON válido:

{
  "indicators": [
    {"name": "IBOVESPA", "value": "196.800", "change": "+1,2%", "direction": "up", "region": "BR", "category": "indice"},
    {"name": "Dólar (comercial)", "value": "R$ 5,10", "change": "-0,8%", "direction": "down", "region": "BR", "category": "moeda"},
    {"name": "S&P 500", "value": "7.012", "change": "+0,3%", "direction": "up", "region": "EUA", "category": "indice"}
  ],
  "global_bullets": ["3-5 bullets: como fecharam S&P, Nasdaq, DXY. Destaques do dia."],
  "brasil_bullets": ["3-5 bullets: IBOV fechamento, dólar fechamento, destaque do pregão."],
  "happened_bullets": ["5-7 bullets: o que de fato aconteceu no pregão — eventos, movimentos surpresa, volume."],
  "agenda_review": "1 parágrafo: os eventos da agenda se confirmaram? Qual o impacto real vs. esperado?",
  "overnight": "2-3 bullets: o que observar no after-market e na madrugada (Ásia, futuros, dados).",
  "sentiment_summary": "1 parágrafo: como ficou o sentimento no fechamento. Medo/euforia mudou durante o dia?",
  "closing_take": "1 parágrafo contextual: review do dia + o que fica pra amanhã. Viés implícito OK."
}

O array "indicators" é OBRIGATÓRIO: preços de FECHAMENTO dos principais ativos do dia com variação %. Inclua 8-15 ativos. Categorias: indice, moeda, commodity, juros. OMITA indicadores cujo valor não estiver disponível nos dados.

Regras:
- Português do Brasil.
- Factual: cite números de fechamento quando disponíveis.
- Se um dado não estiver disponível, omita — nunca invente.
- O "closing_take" fecha o ciclo cognitivo: manhã = plano, noite = review.`;
}
