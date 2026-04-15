import type { ResearchProvider } from "../types";

function hostFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return null; }
}

type BuiltWithFree = {
  Results?: Array<{
    Result?: {
      Paths?: Array<{
        Technologies?: Array<{ Name?: string; Tag?: string; Categories?: string[]; FirstDetected?: number; LastDetected?: number }>;
        Domain?: string;
      }>;
    };
  }>;
  Errors?: unknown;
};

/** BuiltWith — detecta tecnologias no site (CMS, pagamento, analytics, CDN).
 *  Usa o endpoint free1 se BUILTWITH_API_KEY estiver setada. Quando ausente,
 *  faz um fallback simples: baixa o HTML do site e procura fingerprints conhecidos
 *  de gateways de pagamento / analytics. */
export const builtwithProvider: ResearchProvider = {
  id: "builtwith",
  label: "BuiltWith / tech stack",
  description: "Tecnologias detectadas no site (CMS, pagamento, analytics, CDN).",
  searchLike: false,
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    const key = process.env.BUILTWITH_API_KEY;
    if (key) {
      try {
        const r = await fetch(`https://api.builtwith.com/free1/api.json?KEY=${key}&LOOKUP=${host}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (r.ok) {
          const data = (await r.json()) as BuiltWithFree;
          const techs = data.Results?.[0]?.Result?.Paths?.[0]?.Technologies ?? [];
          if (techs.length > 0) {
            const byCat = new Map<string, string[]>();
            for (const t of techs) {
              const cats = (t.Categories && t.Categories.length > 0) ? t.Categories : ["Outros"];
              for (const c of cats) {
                if (!byCat.has(c)) byCat.set(c, []);
                byCat.get(c)!.push(t.Name || "");
              }
            }
            const lines: string[] = [];
            for (const [cat, names] of byCat) {
              lines.push(`• ${cat}\n  ${Array.from(new Set(names)).filter(Boolean).slice(0, 12).join(", ")}`);
            }
            return { providerId: this.id, label: "BuiltWith — tech stack", text: lines.join("\n") };
          }
        }
      } catch {}
    }
    // Fallback heurístico: busca fingerprints de gateways/analytics no HTML
    try {
      const res = await fetch(competitor.website!.startsWith("http") ? competitor.website! : `https://${competitor.website}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "JNews/1.0" },
      });
      if (!res.ok) return null;
      const html = (await res.text()).slice(0, 500_000).toLowerCase();
      const fingerprints: Record<string, string[]> = {
        "Pagamento": ["cielo", "rede.com.br", "stone.com.br", "pagseguro", "pagbank", "mercadopago", "mercadolivre", "pagarme", "adyen", "stripe", "braintree", "worldpay", "checkout.com", "ebanx", "iugu", "gerencianet", "juno", "asaas", "wirecard"],
        "E-commerce": ["shopify", "vtex", "nuvemshop", "tray", "wix", "woocommerce", "magento", "bigcommerce", "loja integrada"],
        "Analytics": ["google-analytics.com", "googletagmanager.com", "gtag/js", "hotjar", "mixpanel", "segment.io", "clarity.ms", "amplitude", "heap"],
        "Mídia / Pixels": ["connect.facebook.net", "fbq(", "tiktok", "linkedin insight", "pinterest", "snap.licdn"],
        "CDN / Cloud": ["cloudfront.net", "akamai", "fastly", "cloudflare", "azureedge", "cdn.shopify", "vercel"],
        "Chat / Atendimento": ["zendesk", "intercom", "drift", "tawk.to", "crisp", "livechat", "jivochat", "movidesk"],
      };
      const out: string[] = [];
      for (const [cat, hints] of Object.entries(fingerprints)) {
        const found = hints.filter((h) => html.includes(h));
        if (found.length > 0) out.push(`• ${cat}\n  ${found.slice(0, 12).join(", ")}`);
      }
      if (out.length === 0) return null;
      return { providerId: this.id, label: "Tech stack (heurística do HTML)", text: out.join("\n") };
    } catch { return null; }
  },
};

// Guard: if we returned from the API but with no usable technologies, the
// outer runner already stores the null result. The empty-content case is
// handled by returning null above.
