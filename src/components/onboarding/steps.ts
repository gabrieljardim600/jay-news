import type { LucideIcon } from "lucide-react";
import { Sparkles, Newspaper, TrendingUp, BarChart3, Search, FileText, Target, Zap, Layers, Filter } from "lucide-react";

export type OnboardingKey = "intro" | "news" | "trends" | "markets" | "query" | "briefings";

export type OnboardingSection = {
  heading: string;
  body: string;
  icon?: LucideIcon;
};

export type OnboardingStep = {
  key: OnboardingKey;
  title: string;
  subtitle: string;
  accent: string; // tailwind color class for the icon badge, ex.: "text-primary bg-primary/10"
  icon: LucideIcon;
  sections: OnboardingSection[];
  footerTip?: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "intro",
    title: "Bem-vindo ao JNews",
    subtitle: "Seu agente de inteligência competitiva — notícias, tendências e dossiês num só lugar.",
    accent: "text-primary bg-primary/10",
    icon: Sparkles,
    sections: [
      { icon: Newspaper, heading: "News", body: "Digests personalizados com notícias do dia nos seus temas." },
      { icon: TrendingUp, heading: "Trends", body: "Pauta quente — assuntos subindo em volume/engajamento." },
      { icon: BarChart3, heading: "Markets", body: "Monitora setores + concorrentes com coleta automática + briefings." },
      { icon: Search, heading: "Consulta", body: "Pesquisa sob demanda: escolhe um perfil (ex.: Subadquirência BR), digita a empresa e recebe dossiê pronto." },
    ],
    footerTip: "Use o botão de ajuda no topo de qualquer tela para rever estas dicas.",
  },
  {
    key: "news",
    title: "News — seu feed editorial",
    subtitle: "Cada aba é um digest configurado por você (tema, fontes, horário).",
    accent: "text-sky-500 bg-sky-500/10",
    icon: Newspaper,
    sections: [
      { icon: Layers, heading: "Abas de digest", body: "Trocar de aba = trocar de digest. Crie novo em '+ Novo' pra cobrir outro assunto." },
      { icon: Zap, heading: "Coleta automática", body: "Roda em cron na frequência que você escolher. Cada artigo já vem com resumo limpo e imagem." },
      { icon: FileText, heading: "Texto tratado", body: "Clica na matéria e abre inline sem redirecionar pro site original." },
    ],
    footerTip: "Em Ajustes (⚙ topo direito) você muda fontes, tópicos, horário e remove assuntos indesejados.",
  },
  {
    key: "trends",
    title: "Trends — o que está pegando agora",
    subtitle: "Radar de assuntos subindo em engajamento no Brasil e no mundo.",
    accent: "text-orange-500 bg-orange-500/10",
    icon: TrendingUp,
    sections: [
      { icon: Filter, heading: "Filtros", body: "Por região (BR/EUA/Global) e tema. Use as pílulas no topo pra alternar rápido." },
      { icon: Target, heading: "Sinal útil", body: "Pra cada trend a gente agrega fontes e mostra o ângulo que tá rendendo — não só o termo." },
    ],
  },
  {
    key: "markets",
    title: "Markets — monitoramento de setor",
    subtitle: "Cada Market = um setor que você acompanha (ex.: subadquirência, seguros, edtech).",
    accent: "text-emerald-500 bg-emerald-500/10",
    icon: BarChart3,
    sections: [
      { icon: Target, heading: "Concorrentes", body: "Liste quem você compete contra. Cada um pode ter site + CNPJ — quanto mais, mais fundo vai a pesquisa." },
      { icon: Newspaper, heading: "Notícias do setor", body: "Coleta diária via RSS + Tavily. Cards abrem a matéria completa tratada." },
      { icon: FileText, heading: "Briefings", body: "Dentro de cada concorrente, gera dossiês completos ou focados em perfis (Produto/Financeiro/Reputação/Liderança/Subadquirência BR)." },
    ],
    footerTip: "Dica: se nunca coletou, clique em 'Coletar' no topo do market pra puxar a primeira leva.",
  },
  {
    key: "query",
    title: "Consulta — dossiê sob demanda",
    subtitle: "Pra olhar uma empresa sem precisar criar um market. 3 passos e pronto.",
    accent: "text-violet-500 bg-violet-500/10",
    icon: Search,
    sections: [
      { icon: Sparkles, heading: "1. Escolha um perfil", body: "'Perfis prontos' bundla módulos + prompt focado (ex.: Subadquirência BR cobre BACEN, taxas, integrações e-commerce). Ou escolha 'Módulos à la carte' pra customizar." },
      { icon: Target, heading: "2. Identifique o alvo", body: "Nome obrigatório; site e CNPJ reforçam a relevância. 'Busca estrita' filtra homônimos (ex.: 'Cielo' vs. 'Cielo Resort')." },
      { icon: FileText, heading: "3. Receba o dossiê", body: "Claude sintetiza em seções estruturadas. Use o TOC lateral pra navegar, copie em markdown ou baixe como .md." },
    ],
    footerTip: "Gerenciador de perfis: ⚙ ao lado do switch Perfis/Módulos. Edite prompts e seções de cada perfil.",
  },
  {
    key: "briefings",
    title: "Briefings — dossiês estruturados",
    subtitle: "Cada briefing é gerado por um perfil (Completo ou Focado) e mostra seções específicas.",
    accent: "text-amber-500 bg-amber-500/10",
    icon: FileText,
    sections: [
      { icon: Layers, heading: "Perfil Completo × Focado", body: "Completo = relatório abrangente (visão geral, produtos, liderança, SWOT). Focado = enxuto, só a ótica escolhida (ex.: só Reputação & CX)." },
      { icon: Target, heading: "O que usa", body: "Research pack do perfil + relevância (nome/CNPJ/site) + filtro estrito. Retorna em ~60s com Claude Sonnet." },
      { icon: Zap, heading: "Reuso", body: "Cache por entidade (CNPJ primeiro, nome+host como fallback). Segundo briefing com mesmos dados é instantâneo." },
    ],
    footerTip: "Edite o prompt ou adicione seções em Gerenciar perfis — ajustes se refletem na próxima geração.",
  },
];

export const STEP_BY_KEY: Record<OnboardingKey, OnboardingStep> = Object.fromEntries(
  ONBOARDING_STEPS.map((s) => [s.key, s]),
) as Record<OnboardingKey, OnboardingStep>;

/** Mapeia o pathname atual para a chave de onboarding mais relevante. */
export function keyForPath(pathname: string): OnboardingKey {
  if (pathname === "/" || pathname.startsWith("/manage")) return "news";
  if (pathname.startsWith("/trends")) return "trends";
  if (pathname.startsWith("/markets")) {
    // Briefings aparecem dentro de competitors/[cid]
    if (pathname.match(/\/competitors\/[^/]+/)) return "briefings";
    return "markets";
  }
  if (pathname.startsWith("/query")) return "query";
  return "intro";
}

export const LS_KEY_SEEN = "jnews.onboarding.v1.seen";
