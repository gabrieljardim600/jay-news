import type { ResearchProvider } from "../types";

export const securityTrailsProvider: ResearchProvider = {
  id: "securitytrails",
  label: "SecurityTrails",
  description: "Subdomínios e histórico DNS. Requer SECURITYTRAILS_API_KEY.",
  enabled: (c) => !!process.env.SECURITYTRAILS_API_KEY && !!c.website,
  async fetch(competitor) {
    const host = (() => {
      try {
        const u = new URL(competitor.website!.startsWith("http") ? competitor.website! : `https://${competitor.website}`);
        return u.hostname.replace(/^www\./, "");
      } catch { return null; }
    })();
    if (!host) return null;
    try {
      const res = await fetch(`https://api.securitytrails.com/v1/domain/${host}/subdomains?children_only=true`, {
        headers: { APIKEY: process.env.SECURITYTRAILS_API_KEY!, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { subdomains?: string[]; subdomain_count?: number };
      const subs = data.subdomains || [];
      if (subs.length === 0) return null;
      const sample = subs.slice(0, 25).map((s) => `${s}.${host}`);
      return {
        providerId: this.id,
        label: "SecurityTrails — subdomínios",
        text: `Total: ${data.subdomain_count ?? subs.length}\nAmostra:\n${sample.map((s) => `• ${s}`).join("\n")}`,
      };
    } catch { return null; }
  },
};
