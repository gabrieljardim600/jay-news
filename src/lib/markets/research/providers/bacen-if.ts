import type { ResearchProvider } from "../types";

/**
 * BACEN — consulta pública de instituições financeiras / instituições de
 * pagamento autorizadas. A lista completa está em dados abertos:
 * https://dadosabertos.bcb.gov.br/dataset/instituicoes-financeiras
 * e https://olinda.bcb.gov.br/olinda/servico/Informes_ADM/versao/v1/odata/
 *
 * Estratégia: usar a API Olinda para procurar pelo nome.
 */

type BcbRow = {
  CnpjCompleto?: string;
  Nome?: string;
  Segmento?: string;
  TipoInstituicao?: string;
  DataInicioAtividade?: string;
  SituacaoCadastral?: string;
};

export const bacenIfProvider: ResearchProvider = {
  id: "bacen-if",
  label: "BACEN — instituições autorizadas",
  description: "Registro oficial de instituição financeira ou de pagamento no Banco Central.",
  enabled: (_c, m) => m.language === "pt-BR",
  async fetch(competitor) {
    const url = `https://olinda.bcb.gov.br/olinda/servico/Informes_ADM/versao/v1/odata/IfDataValores?$top=5&$format=json&$filter=${encodeURIComponent(`contains(Nome,'${competitor.name}')`)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { value?: BcbRow[] };
      const rows = data.value || [];
      if (rows.length === 0) return null;
      const lines = rows.map((r) =>
        [`• ${r.Nome ?? "(sem nome)"}${r.CnpjCompleto ? ` (CNPJ ${r.CnpjCompleto})` : ""}`, `  Tipo: ${r.TipoInstituicao ?? "-"}`, r.Segmento && `  Segmento: ${r.Segmento}`, r.DataInicioAtividade && `  Início: ${r.DataInicioAtividade}`, r.SituacaoCadastral && `  Situação: ${r.SituacaoCadastral}`].filter(Boolean).join("\n"),
      );
      const primaryCnpj = rows.find((r) => r.CnpjCompleto)?.CnpjCompleto;
      return {
        providerId: this.id,
        label: "BACEN — cadastro de IF/IP",
        text: lines.join("\n"),
        hints: primaryCnpj ? { cnpj: primaryCnpj } : undefined,
      };
    } catch {
      return null;
    }
  },
};
