import { isRecord } from "../types.js";

const SECRET_KEY_PARTS = ["token", "secret", "password", "passwd", "credential", "authorization", "cookie", "sessionkey", "apikey", "privatekey", "clientsecret"];
const MAX_DEPTH = 7;
const MAX_ARRAY = 50;
const MAX_KEYS = 80;
const MAX_STRING = 500;

function redactString(value: string): string {
  const bounded = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}[TRUNCATED]` : value;
  return bounded
    .replace(/(authorization\s*:\s*)(?:bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/\bbearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|gh[opsu]|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/([?&](?:token|key|secret|password)=)[^&#\s]+/gi, "$1[REDACTED]");
}

function redact(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const rows = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY) rows.push("[TRUNCATED]");
    return rows;
  }
  if (!isRecord(value)) return String(value).slice(0, MAX_STRING);

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, MAX_KEYS);
  for (const [key, item] of entries) {
    const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    out[key] = SECRET_KEY_PARTS.some((part) => normalizedKey.includes(part)) ? "[REDACTED]" : redact(item, depth + 1);
  }
  if (Object.keys(value).length > MAX_KEYS) out._truncated = true;
  return out;
}

export function redactForLog(value: unknown): unknown {
  return redact(value, 0);
}
