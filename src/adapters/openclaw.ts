import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, normalize, relative } from "node:path";
import { classifyCommandFailure, runBoundedCommand, type CommandRunner } from "../lib/process.js";
import { finiteNumber, isRecord, safeBoolean, safeString, type SourceState } from "../types.js";

export type OpenClawOperation = "health" | "models" | "config_validate";

export function buildOpenClawArgs(operation: OpenClawOperation): string[] {
  switch (operation) {
    case "health":
      return ["health", "--json", "--timeout", "2500"];
    case "models":
      return ["models", "list", "--json"];
    case "config_validate":
      return ["config", "validate", "--json"];
    default:
      throw new Error("unsupported_openclaw_operation");
  }
}

function safeStringArray(value: unknown, limit = 64): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item : isRecord(item) ? safeString(item.id ?? item.name, 96) : undefined)
    .filter((item): item is string => Boolean(item))
    .slice(0, limit)
    .sort((a, b) => a.localeCompare(b));
}

function countRows(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function summarizeChannels(value: unknown): Array<Record<string, unknown>> {
  const rows: Array<[string, unknown]> = Array.isArray(value)
    ? value.slice(0, 32).map((item, index) => [isRecord(item) ? safeString(item.name ?? item.channel ?? item.id, 64) ?? `channel_${index}` : `channel_${index}`, item])
    : isRecord(value)
      ? Object.entries(value).slice(0, 32)
      : [];

  return rows.map(([name, raw]) => {
    const channel = isRecord(raw) ? raw : {};
    const summary: Record<string, unknown> = { name: name.slice(0, 64) };
    for (const key of ["configured", "enabled", "running", "connected", "healthy", "ready"] as const) {
      const observed = safeBoolean(channel[key]);
      if (observed !== undefined) summary[key] = observed;
    }
    if (Array.isArray(channel.accounts)) {
      summary.account_count = channel.accounts.length;
      summary.unhealthy_account_count = channel.accounts.filter((account) => {
        if (!isRecord(account)) return true;
        return account.healthy === false || account.connected === false || account.running === false;
      }).length;
    }
    return summary;
  });
}

function accumulateQueueMetrics(value: unknown, metrics: { failed: number; pending: number }, depth = 0): void {
  if (depth > 5 || !isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll(/[^a-z]/g, "");
    const number = finiteNumber(item);
    if (number !== undefined) {
      if (normalized.includes("failed") || normalized.includes("deadletter")) metrics.failed += Math.max(0, number);
      else if (["pending", "prepared", "queued", "claimed", "blocked"].some((needle) => normalized.includes(needle))) metrics.pending += Math.max(0, number);
    } else if (isRecord(item)) {
      accumulateQueueMetrics(item, metrics, depth + 1);
    }
  }
}

export type SafeOpenClawHealth = {
  state: SourceState;
  ok: boolean;
  version?: string;
  status?: string;
  duration_ms?: number;
  plugins: { loaded: string[]; loaded_count: number; error_count: number };
  channels: Array<Record<string, unknown>>;
  event_loop: { degraded?: boolean; delay_p99_ms?: number; delay_max_ms?: number; utilization?: number };
  delivery_queues: { failed: number; pending: number };
  observed_at: string;
};

export function sanitizeOpenClawHealth(value: unknown): SafeOpenClawHealth {
  const root = isRecord(value) ? value : {};
  const plugins = isRecord(root.plugins) ? root.plugins : {};
  const loaded = safeStringArray(plugins.loaded ?? plugins.active ?? root.loadedPlugins);
  const pluginErrorCount = countRows(plugins.errors) + countRows(plugins.unavailable) + countRows(plugins.failed);
  const channels = summarizeChannels(root.channels);
  const eventLoop = isRecord(root.eventLoop) ? root.eventLoop : {};
  const deliveryQueues = root.deliveryQueues ?? root.deliveryQueue;
  const queueMetrics = { failed: 0, pending: 0 };
  accumulateQueueMetrics(deliveryQueues, queueMetrics);
  const ok = root.ok === true;
  const starting = root.status === "starting";
  const channelFailure = channels.some((channel) => channel.healthy === false || channel.ready === false || channel.running === false);
  const degraded = starting || eventLoop.degraded === true || pluginErrorCount > 0 || queueMetrics.failed > 0 || channelFailure;

  return {
    state: !ok && !starting ? "down" : degraded ? "degraded" : "ok",
    ok,
    ...(safeString(root.version, 64) ? { version: safeString(root.version, 64) } : {}),
    ...(safeString(root.status, 48) ? { status: safeString(root.status, 48) } : {}),
    ...(finiteNumber(root.durationMs) !== undefined ? { duration_ms: finiteNumber(root.durationMs) } : {}),
    plugins: { loaded, loaded_count: loaded.length, error_count: pluginErrorCount },
    channels,
    event_loop: {
      ...(safeBoolean(eventLoop.degraded) !== undefined ? { degraded: safeBoolean(eventLoop.degraded) } : {}),
      ...(finiteNumber(eventLoop.delayP99Ms) !== undefined ? { delay_p99_ms: finiteNumber(eventLoop.delayP99Ms) } : {}),
      ...(finiteNumber(eventLoop.delayMaxMs) !== undefined ? { delay_max_ms: finiteNumber(eventLoop.delayMaxMs) } : {}),
      ...(finiteNumber(eventLoop.utilization) !== undefined ? { utilization: finiteNumber(eventLoop.utilization) } : {}),
    },
    delivery_queues: queueMetrics,
    observed_at: new Date().toISOString(),
  };
}

export type SafeExternalModel = {
  id: string;
  name?: string;
  provider?: string;
  available?: boolean;
  configured?: boolean;
  local?: boolean;
  context_window?: number;
};

export function sanitizeOpenClawModels(value: unknown): { state: SourceState; count: number; models: SafeExternalModel[]; catalog_only: true; observed_at: string } {
  const root = isRecord(value) ? value : {};
  const rawModels = Array.isArray(value) ? value : Array.isArray(root.models) ? root.models : Array.isArray(root.data) ? root.data : [];
  const models: SafeExternalModel[] = [];
  for (const raw of rawModels.slice(0, 256)) {
    if (!isRecord(raw)) continue;
    const id = safeString(raw.id ?? raw.key ?? raw.model, 160);
    if (!id) continue;
    const model: SafeExternalModel = { id };
    const name = safeString(raw.name ?? raw.label ?? raw.displayName, 160);
    const provider = safeString(raw.provider ?? raw.providerId, 80);
    const available = safeBoolean(raw.available);
    const configured = safeBoolean(raw.configured);
    const local = safeBoolean(raw.local);
    const contextWindow = finiteNumber(raw.contextWindow ?? raw.contextTokens);
    if (name) model.name = name;
    if (provider) model.provider = provider;
    if (available !== undefined) model.available = available;
    if (configured !== undefined) model.configured = configured;
    if (local !== undefined) model.local = local;
    if (contextWindow !== undefined) model.context_window = contextWindow;
    models.push(model);
  }
  return {
    state: models.length ? "ok" : "unknown",
    count: models.length,
    models,
    catalog_only: true,
    observed_at: new Date().toISOString(),
  };
}

export function sanitizeOpenClawModelStatus(value: unknown): { state: SourceState; count: number; models: SafeExternalModel[]; catalog_only: true; catalog_kind: "configured_routes_fallback"; observed_at: string } {
  const root = isRecord(value) ? value : {};
  const references = new Set<string>();
  const add = (candidate: unknown) => {
    const reference = safeString(candidate, 160);
    if (reference) references.add(reference);
  };
  add(root.defaultModel);
  add(root.resolvedDefault);
  for (const key of ["fallbacks", "imageFallbacks", "allowed"] as const) {
    if (Array.isArray(root[key])) root[key].slice(0, 128).forEach(add);
  }
  if (isRecord(root.utilityModel)) add(root.utilityModel.ref);
  if (isRecord(root.aliases)) Object.values(root.aliases).slice(0, 128).forEach(add);
  const models = [...references].sort((a, b) => a.localeCompare(b)).map((id) => ({
    id,
    ...(id.includes("/") ? { provider: id.split("/", 1)[0] } : {}),
    configured: true,
  }));
  return {
    state: models.length ? "ok" : "unknown",
    count: models.length,
    models,
    catalog_only: true,
    catalog_kind: "configured_routes_fallback",
    observed_at: new Date().toISOString(),
  };
}

function classifyOpenClawJsonError(stdout: string): { state: "blocked" | "unknown" | "degraded"; reason: string } | null {
  try {
    const root = JSON.parse(stdout) as unknown;
    if (!isRecord(root) || root.ok !== false || !isRecord(root.error)) return null;
    const message = safeString(root.error.message, 500)?.toLowerCase() ?? "";
    if (message.includes("auth") || message.includes("credential") || message.includes("login")) return { state: "blocked", reason: "authentication_required_or_failed" };
    if (message.includes("catalog")) return { state: "unknown", reason: "published_model_catalog_unavailable" };
    if (message.includes("gateway")) return { state: "unknown", reason: "gateway_catalog_error" };
    return { state: "degraded", reason: "openclaw_cli_error" };
  } catch {
    return null;
  }
}

export function sanitizeOpenClawConfigValidation(value: unknown): Record<string, unknown> {
  const root = isRecord(value) ? value : {};
  const ok = root.ok === true || root.valid === true;
  const errors = countRows(root.errors) + countRows(root.issues);
  const warnings = countRows(root.warnings);
  return {
    state: ok && errors === 0 ? (warnings > 0 ? "degraded" : "ok") : "degraded",
    ok,
    error_count: errors,
    warning_count: warnings,
    observed_at: new Date().toISOString(),
  };
}

function resolveOpenClawEntry(): string | null {
  const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  const root = normalize(join(appData, "npm", "node_modules", "openclaw"));
  const candidate = join(root, "openclaw.mjs");
  if (!existsSync(candidate)) return null;
  try {
    const resolvedRoot = realpathSync(root);
    const resolvedCandidate = realpathSync(candidate);
    const relation = relative(resolvedRoot, resolvedCandidate);
    if (relation.startsWith("..") || relation === "" || relation.includes("\0")) return null;
    return resolvedCandidate;
  } catch {
    return null;
  }
}

export async function runOpenClawReadOnly(operation: OpenClawOperation, runner: CommandRunner = runBoundedCommand): Promise<Record<string, unknown>> {
  const entry = resolveOpenClawEntry();
  if (!entry) return { state: "unknown", reason: "openclaw_not_installed", operation };
  const args = [entry, ...buildOpenClawArgs(operation)];
  const result = await runner(process.execPath, args, {
    timeout_ms: operation === "health" ? 12_000 : 12_000,
    max_output_bytes: 524_288,
    cwd: dirname(entry),
  });
  if (result.exit_code !== 0 || result.timed_out || result.output_limited || result.spawn_error) {
    if (operation === "models" && !result.timed_out && !result.output_limited && !result.spawn_error) {
      const firstFailure = classifyOpenClawJsonError(result.stdout);
      if (firstFailure?.reason === "published_model_catalog_unavailable") {
        const fallback = await runner(process.execPath, [entry, "models", "status", "--json"], {
          timeout_ms: 20_000,
          max_output_bytes: 524_288,
          cwd: dirname(entry),
        });
        if (fallback.exit_code === 0 && !fallback.timed_out && !fallback.output_limited && !fallback.spawn_error) {
          try { return sanitizeOpenClawModelStatus(JSON.parse(fallback.stdout) as unknown); } catch { /* classified below */ }
        }
      }
      if (firstFailure) return { ...firstFailure, operation, duration_ms: result.duration_ms };
    }
    return { ...classifyCommandFailure(result), operation, duration_ms: result.duration_ms };
  }
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (operation === "health") return sanitizeOpenClawHealth(parsed);
    if (operation === "models") return sanitizeOpenClawModels(parsed);
    return sanitizeOpenClawConfigValidation(parsed);
  } catch {
    return { state: "degraded", reason: "invalid_json", operation, duration_ms: result.duration_ms };
  }
}
