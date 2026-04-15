import type { ResearchProvider } from "../types";

export const shodanProvider: ResearchProvider = {
  id: "shodan",
  label: "Shodan",
  description: "Serviços expostos pelo domínio da empresa. Requer SHODAN_API_KEY.",
  enabled: (c) => !!process.env.SHODAN_API_KEY && !!c.website,
  async fetch(competitor) {
    const host = (() => {
      try {
        const u = new URL(competitor.website!.startsWith("http") ? competitor.website! : `https://${competitor.website}`);
        return u.hostname.replace(/^www\./, "");
      } catch { return null; }
    })();
    if (!host) return null;
    try {
      const res = await fetch(`https://api.shodan.io/shodan/host/search?key=${process.env.SHODAN_API_KEY}&query=${encodeURIComponent(`hostname:${host}`)}&limit=10`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { total?: number; matches?: Array<{ ip_str: string; port: number; product?: string; org?: string }> };
      const matches = data.matches || [];
      if (matches.length === 0) return null;
      const lines = [
        `Total de hosts: ${data.total ?? matches.length}`,
        ...matches.slice(0, 10).map((m) => `• ${m.ip_str}:${m.port}${m.product ? ` · ${m.product}` : ""}${m.org ? ` · ${m.org}` : ""}`),
      ];
      return { providerId: this.id, label: "Shodan", text: lines.join("\n") };
    } catch { return null; }
  },
};
