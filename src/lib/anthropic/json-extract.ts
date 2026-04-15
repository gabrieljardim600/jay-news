/**
 * Extract the first valid JSON value (object or array) from an LLM response.
 * Strips code fences, strips leading commentary, and tries progressive slicing
 * if the first brace/bracket doesn't parse.
 */
export function extractJson<T = unknown>(raw: string): T {
  if (!raw || typeof raw !== "string") throw new Error("Empty LLM response");
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // Fast path: the entire text is already valid JSON
  try {
    return JSON.parse(text) as T;
  } catch {}

  // Slow path: find the first { or [ and try parsing increasingly larger slices
  const openIdx = Math.min(
    ...["{", "["]
      .map((ch) => text.indexOf(ch))
      .filter((i) => i >= 0)
      .concat([Number.POSITIVE_INFINITY])
  );
  if (!Number.isFinite(openIdx)) throw new Error("No JSON found in LLM response");

  const openChar = text[openIdx];
  const closeChar = openChar === "{" ? "}" : "]";

  // Walk matching brackets
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        const slice = text.slice(openIdx, i + 1);
        return JSON.parse(slice) as T;
      }
    }
  }
  throw new Error("Unterminated JSON in LLM response");
}
