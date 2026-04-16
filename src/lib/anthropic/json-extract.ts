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
  // Tolerant recovery: LLM response was cut off mid-JSON. Trim to the last
  // complete value/key and close open brackets/strings so we still return
  // something usable instead of failing the whole briefing.
  const recovered = recoverTruncatedJson(text.slice(openIdx));
  if (recovered != null) {
    try { return JSON.parse(recovered) as T; } catch {}
  }
  throw new Error("Unterminated JSON in LLM response");
}

function recoverTruncatedJson(src: string): string | null {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  // Track the last position where we were outside a string and had just
  // finished a complete value (comma or end of value).
  let lastSafe = -1;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; if (!inString) lastSafe = i + 1; continue; }
    if (inString) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      lastSafe = i + 1;
    } else if (c === "," || c === ":" || /\s/.test(c)) {
      if (c === ",") lastSafe = i; // trim trailing comma
    } else {
      // literal (number/bool/null) — safe point moves to after it
      lastSafe = i + 1;
    }
  }

  if (lastSafe < 0) return null;

  let out = src.slice(0, lastSafe);
  // Drop trailing comma and whitespace
  out = out.replace(/[\s,]+$/g, "");
  // If we were inside a string, close it
  if (inString) out += '"';
  // Close every open bracket in reverse order
  // Re-scan `out` to compute final stack
  const stack2: string[] = [];
  let inStr2 = false;
  let esc2 = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (esc2) { esc2 = false; continue; }
    if (c === "\\") { esc2 = true; continue; }
    if (c === '"') { inStr2 = !inStr2; continue; }
    if (inStr2) continue;
    if (c === "{" || c === "[") stack2.push(c);
    else if (c === "}") { if (stack2[stack2.length - 1] === "{") stack2.pop(); }
    else if (c === "]") { if (stack2[stack2.length - 1] === "[") stack2.pop(); }
  }
  while (stack2.length > 0) {
    const open = stack2.pop()!;
    // If the last char looks like an unfinished key (quote + colon missing
    // value), drop it by trimming back to the previous comma/brace.
    if (open === "{") {
      const tail = out.replace(/\s+$/, "");
      if (/[,{]\s*"[^"]*"\s*:\s*$/.test(tail)) {
        out = tail.replace(/[,{]\s*"[^"]*"\s*:\s*$/, (m) => m[0] === "{" ? "{" : "");
      } else if (/:\s*$/.test(tail)) {
        out = tail.replace(/:\s*$/, ": null");
      }
      out += "}";
    } else {
      out += "]";
    }
  }
  return out;
}
