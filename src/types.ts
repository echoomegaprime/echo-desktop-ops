export type SourceState = "ok" | "degraded" | "down" | "blocked" | "unknown";

export type StatusLight = {
  id: string;
  label: string;
  group: "local" | "fleet" | "service" | "governance" | "model";
  state: SourceState;
  summary: string;
  reason?: string;
  observed_at?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function safeString(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

export function normalizeState(value: unknown): SourceState {
  return value === "ok" || value === "degraded" || value === "down" || value === "blocked" || value === "unknown"
    ? value
    : "unknown";
}

export function aggregateState(states: SourceState[]): SourceState {
  if (!states.length) return "unknown";
  if (states.includes("down")) return "down";
  if (states.includes("degraded")) return "degraded";
  if (states.includes("blocked")) return "blocked";
  if (states.includes("unknown")) return "unknown";
  return "ok";
}
