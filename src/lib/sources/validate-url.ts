export function isValidRssUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
}

export function isValidWebDomain(domain: string): boolean {
  // Accept bare domains (dnews.com.br) or full URLs (https://dnews.com.br)
  const normalized = domain.includes("://") ? domain : `https://${domain}`;
  try {
    const url = new URL(normalized);
    if (isPrivateHost(url.hostname)) return false;
    // Must have at least one dot (e.g. "example.com")
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function extractDomain(input: string): string {
  const normalized = input.includes("://") ? input : `https://${input}`;
  try {
    const url = new URL(normalized);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");
  }
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  const parts = h.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    if (first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 127) return true;
    if (first === 0) return true;
  }
  return false;
}
