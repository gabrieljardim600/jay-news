/** Perfis de briefing padrão — seeded por usuário na primeira leitura.
 *  Depois de semeados, o usuário pode editar à vontade pela UI. */

export type OutputSectionKind = "paragraph" | "list" | "keyvalue";

export type OutputSection = {
  id: string;        // chave no JSON retornado pelo Claude
  title: string;     // título exibido
  kind: OutputSectionKind;
  hint?: string;     // guidance pro LLM
};

export type DefaultProfile = {
  slug: string;
  label: string;
  description: string;
  icon: string;
  sort_order: number;
  module_ids: string[];
  synth_prompt: string;
  output_sections: OutputSection[];
};

export const DEFAULT_PROFILES: DefaultProfile[] = [
  {
    slug: "product-gtm",
    label: "Produto & GTM",
    description: "Posicionamento, funil, criativos ativos e sentimento de mercado.",
    icon: "Megaphone",
    sort_order: 10,
    module_ids: ["paid-marketing", "mobile", "social-voice", "trends", "web-footprint"],
    synth_prompt:
      "Você é analista de produto/GTM. Foque em posicionamento, canais pagos ativos, ângulos de copy, jornada do site/app, sinais de demanda e sentimento do público. Cite criativos, landing pages e termos em alta específicos.",
    output_sections: [
      { id: "posicionamento", title: "Posicionamento", kind: "paragraph", hint: "1-2 parágrafos citando promessa principal e público-alvo." },
      { id: "canais_pagos", title: "Canais pagos & criativos", kind: "list", hint: "Plataformas com anúncios ativos + exemplos de ângulos/copy." },
      { id: "jornada_site", title: "Jornada & UX", kind: "list", hint: "Rotas-chave, CTAs principais, pontos de atrito no fluxo." },
      { id: "apps_mobile", title: "Apps & mobile", kind: "keyvalue", hint: "Rating, reviews, volume de downloads quando disponível." },
      { id: "demanda_trends", title: "Demanda & tendências", kind: "list", hint: "Termos correlatos em alta, sazonalidade." },
      { id: "sentimento", title: "Sentimento social", kind: "paragraph", hint: "Reddit/HN/YouTube — elogios e críticas recorrentes." },
      { id: "perguntas", title: "Perguntas para investigar", kind: "list" },
    ],
  },
  {
    slug: "financial-dd",
    label: "Due diligence financeira",
    description: "Receita, estrutura societária, captação, processos e compliance.",
    icon: "Coins",
    sort_order: 20,
    module_ids: ["corporate-registry", "financial-public", "gov-contracts", "legal", "funding"],
    synth_prompt:
      "Você é analista de M&A/DD. Foque em dados oficiais: razão social, CNPJ, capital social, CNAEs, controladores, free float, receita, market cap, contratos governamentais, processos relevantes e captação. Sinalize risco e flags.",
    output_sections: [
      { id: "identidade", title: "Identidade corporativa", kind: "keyvalue", hint: "Razão social, CNPJ, porte, sede, data de fundação, CNAEs principais." },
      { id: "societario", title: "Estrutura societária", kind: "paragraph", hint: "Controladores, free float, conselho — cite fontes oficiais." },
      { id: "financeiros", title: "Indicadores financeiros", kind: "keyvalue", hint: "Receita, lucro, market cap, ticker, fatos recentes da CVM." },
      { id: "contratos_gov", title: "Contratos com governo", kind: "list", hint: "Órgãos, valores e vigência dos principais." },
      { id: "processos", title: "Processos & regulatório", kind: "list", hint: "Ações relevantes, multas, sanções (DOU/Procon)." },
      { id: "captacao", title: "Histórico de captação", kind: "list", hint: "Rodadas conhecidas, investidores, valuation." },
      { id: "red_flags", title: "Pontos de atenção", kind: "list" },
    ],
  },
  {
    slug: "tech",
    label: "Tecnologia & engenharia",
    description: "Stack, infra exposta, patentes e sinais de engenharia.",
    icon: "Server",
    sort_order: 30,
    module_ids: ["infra", "web-footprint", "ip", "social-voice"],
    synth_prompt:
      "Você é analista técnico. Foque em pegada de infraestrutura, hosts/subdomínios, tecnologias detectadas, performance web, portfólio de patentes/IP e sinais de engenharia em Hacker News, Reddit e GitHub quando disponíveis.",
    output_sections: [
      { id: "stack", title: "Stack & infraestrutura", kind: "list", hint: "Cloud, CDN, linguagens, frameworks identificáveis." },
      { id: "footprint", title: "Pegada web", kind: "list", hint: "Subdomínios relevantes, rotas expostas, histórico Wayback." },
      { id: "performance", title: "Performance", kind: "keyvalue", hint: "Core Web Vitals (CrUX) se disponível." },
      { id: "seguranca", title: "Superfície de segurança", kind: "list", hint: "Serviços Shodan, tecnologias obsoletas aparentes." },
      { id: "ip_patentes", title: "Propriedade intelectual", kind: "list", hint: "Patentes ativas e áreas tecnológicas cobertas." },
      { id: "engenharia", title: "Sinais de engenharia", kind: "paragraph", hint: "Discussões no HN/Reddit, palestras, open source." },
      { id: "perguntas", title: "Perguntas técnicas", kind: "list" },
    ],
  },
  {
    slug: "reputation-cx",
    label: "Reputação & CX",
    description: "Satisfação do cliente, principais queixas e rating de apps.",
    icon: "Star",
    sort_order: 40,
    module_ids: ["reputation", "legal", "social-voice"],
    synth_prompt:
      "Você é analista de CX/brand. Foque em NPS proxy (Reclame Aqui, Trustpilot, consumidor.gov), temas recorrentes de reclamação, respostas da marca, exposição jurídica de consumidor e tom orgânico no social.",
    output_sections: [
      { id: "nps_proxy", title: "NPS proxy", kind: "keyvalue", hint: "Score e nº de avaliações em cada plataforma." },
      { id: "top_queixas", title: "Top queixas", kind: "list", hint: "Temas recorrentes de reclamação com exemplos." },
      { id: "top_elogios", title: "Top elogios", kind: "list" },
      { id: "resposta_marca", title: "Resposta da marca", kind: "paragraph", hint: "% resolvidas, tempo médio, tom do atendimento." },
      { id: "apps_rating", title: "Rating de apps", kind: "keyvalue", hint: "Play/App Store: nota e volume." },
      { id: "consumidor_gov", title: "Consumidor.gov / Procon", kind: "list" },
      { id: "recomendacoes", title: "Recomendações", kind: "list" },
    ],
  },
  {
    slug: "leadership",
    label: "Liderança",
    description: "Quem é quem, histórico e pegada pública dos executivos.",
    icon: "Users",
    sort_order: 50,
    module_ids: ["leadership", "financial-public", "social-voice"],
    synth_prompt:
      "Você é analista de people intelligence. Foque em mapear a liderança executiva (CEO, diretoria, conselho), mandato, background, movimentações recentes e pegada pública em LinkedIn/mídia. Use CVM FRE como fonte primária quando listada.",
    output_sections: [
      { id: "ceo", title: "CEO / primeiro executivo", kind: "paragraph", hint: "Nome, desde quando, background, foco declarado." },
      { id: "diretoria", title: "Diretoria executiva", kind: "list", hint: "Nome — Cargo (desde ano) — background." },
      { id: "conselho", title: "Conselho de administração", kind: "list" },
      { id: "movimentos", title: "Movimentações recentes", kind: "list", hint: "Contratações, saídas, promoções no último ano." },
      { id: "pegada_publica", title: "Pegada pública", kind: "paragraph", hint: "Visibilidade dos executivos (entrevistas, posts, palestras)." },
      { id: "riscos_succession", title: "Riscos de sucessão", kind: "list" },
    ],
  },
];
