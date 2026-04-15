import type { ResearchProvider } from "../types";

type BrasilApiCnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  data_inicio_atividade: string | null;
  capital_social: number | null;
  natureza_juridica: string | null;
  porte: string | null;
  descricao_porte: string | null;
  situacao_cadastral: number | null;
  descricao_situacao_cadastral: string | null;
  cnae_fiscal_descricao: string | null;
  municipio: string | null;
  uf: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  qsa: Array<{ nome_socio: string; qualificacao_socio: string }> | null;
};

async function fetchCnpj(cnpj: string): Promise<BrasilApiCnpj | null> {
  const clean = cnpj.replace(/\D+/g, "");
  if (clean.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const brasilApiCnpjProvider: ResearchProvider = {
  id: "brasilapi-cnpj",
  label: "BrasilAPI — CNPJ (Receita Federal)",
  description: "Razão social, QSA, capital social, CNAE, endereço oficial.",
  enabled: (c, m) => m.language === "pt-BR" && !!c.cnpj,
  async fetch(competitor) {
    if (!competitor.cnpj) return null;
    const data = await fetchCnpj(competitor.cnpj);
    if (!data) return null;
    const lines: string[] = [];
    lines.push(`CNPJ: ${data.cnpj}`);
    lines.push(`Razão social: ${data.razao_social}`);
    if (data.nome_fantasia) lines.push(`Nome fantasia: ${data.nome_fantasia}`);
    if (data.data_inicio_atividade) lines.push(`Início de atividade: ${data.data_inicio_atividade}`);
    if (data.capital_social != null) lines.push(`Capital social: R$ ${data.capital_social.toLocaleString("pt-BR")}`);
    if (data.porte || data.descricao_porte) lines.push(`Porte: ${data.descricao_porte ?? data.porte}`);
    if (data.natureza_juridica) lines.push(`Natureza jurídica: ${data.natureza_juridica}`);
    if (data.descricao_situacao_cadastral) lines.push(`Situação cadastral: ${data.descricao_situacao_cadastral}`);
    if (data.cnae_fiscal_descricao) lines.push(`CNAE principal: ${data.cnae_fiscal_descricao}`);
    const addr = [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ");
    if (addr) lines.push(`Endereço: ${addr}`);
    if (data.qsa && data.qsa.length) {
      lines.push("QSA (sócios/administradores):");
      for (const s of data.qsa.slice(0, 15)) lines.push(`  - ${s.nome_socio} — ${s.qualificacao_socio}`);
    }
    return {
      providerId: this.id,
      label: "BrasilAPI CNPJ (Receita Federal)",
      text: lines.join("\n"),
      hints: {
        cnpj: data.cnpj,
        razao_social: data.razao_social,
      },
    };
  },
};
