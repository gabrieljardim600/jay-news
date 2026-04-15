import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** Pegada do concorrente nos marketplaces de apps das principais plataformas
 *  de e-commerce BR — proxy forte de share entre PSPs/subadquirentes. */
export const ecommercePlatformsProvider: ResearchProvider = {
  id: "ecommerce-platforms",
  label: "E-commerce — integrações",
  description: "Apps na Nuvemshop, VTEX, Tray, Shopify, WooCommerce.",
  searchLike: true,
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const queries: Array<{ q: string; domains: string[]; label: string }> = [
      { q: `${competitor.name} integração checkout`, domains: ["nuvemshop.com.br", "apps.tiendanube.com"], label: "Nuvemshop" },
      { q: `${competitor.name}`, domains: ["apps.vtex.com", "vtex.com"], label: "VTEX" },
      { q: `${competitor.name} integração`, domains: ["tray.com.br"], label: "Tray" },
      { q: `${competitor.name} payment gateway`, domains: ["apps.shopify.com"], label: "Shopify" },
      { q: `${competitor.name} woocommerce plugin`, domains: ["wordpress.org/plugins"], label: "WooCommerce" },
      { q: `${competitor.name} módulo magento`, domains: ["marketplace.magento.com"], label: "Magento" },
    ];
    const out: string[] = [];
    for (const { q, domains, label } of queries) {
      try {
        const r = await searchTavily(q, 3, domains, "basic", 720);
        if (r.length > 0) {
          out.push(`• ${label}`);
          for (const it of r) out.push(`  - ${it.title}\n    ${it.content.slice(0, 220)}\n    ${it.url}`);
        }
      } catch {}
    }
    if (out.length === 0) return null;
    return { providerId: this.id, label: "E-commerce — integrações & apps", text: out.join("\n") };
  },
};
