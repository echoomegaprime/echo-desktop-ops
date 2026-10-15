import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize, relative } from "node:path";
import { classifyCommandFailure, runBoundedCommand, type CommandRunner } from "../lib/process.js";
import { finiteNumber, isRecord, normalizeState, safeString, type SourceState } from "../types.js";

const FLEET_NODES = ["FORGE", "ANVIL", "TEMPER", "HAMMER", "CRUCIBLE"] as const;
const SAFE_REASONS = new Set([
  "authentication_required",
  "authentication_failed",
  "connection_timed_out",
  "connection_refused",
  "name_resolution_failed",
  "host_key_verification_failed",
  "collector_command_failed",
  "required_gpu_or_disk_telemetry_missing",
  "endpoint_not_configured",
  "endpoint_unhealthy",
  "queue_depth_missing_or_invalid",
  "recognized_training_fields_missing",
  "unexpected_response_shape",
  "RUNPOD_API_KEY_not_available",
]);

export type SafeFleetNode = {
  name: string;
  state: SourceState;
  reason?: string;
  hostname?: string;
  gpu_count: number;
  gpu_memory_used_mib?: number;
  gpu_memory_total_mib?: number;
  max_gpu_utilization_percent?: number;
  disk_count: number;
  max_disk_used_percent?: number;
  platform_state: "unknown";
  desired_platform?: "linux";
};

function safeReason(value: unknown): string | undefined {
  const reason = safeString(value, 80);
  if (!reason) return undefined;
  return SAFE_REASONS.has(reason) ? reason : "collector_failed";
}

function sanitizeNode(raw: unknown, fallbackName: string): SafeFleetNode {
  const node = isRecord(raw) ? raw : {};
  const rawName = safeString(node.name, 24)?.toUpperCase();
  const name = rawName && FLEET_NODES.includes(rawName as typeof FLEET_NODES[number]) ? rawName : fallbackName;
  const gpus = Array.isArray(node.gpus) ? node.gpus.filter(isRecord).slice(0, 16) : [];
  const disks = Array.isArray(node.disks) ? node.disks.filter(isRecord).slice(0, 32) : [];
  const gpuUsed = gpus.map((gpu) => finiteNumber(gpu.memory_used_mib)).filter((value): value is number => value !== undefined);
  const gpuTotal = gpus.map((gpu) => finiteNumber(gpu.memory_total_mib)).filter((value): value is number => value !== undefined);
  const gpuUtil = gpus.map((gpu) => finiteNumber(gpu.utilization_percent)).filter((value): value is number => value !== undefined);
  const diskUse = disks.map((disk) => finiteNumber(disk.used_percent)).filter((value): value is number => value !== undefined);
  return {
    name,
    state: normalizeState(node.state),
    ...(safeReason(node.reason) ? { reason: safeReason(node.reason) } : {}),
    ...(safeString(node.hostname, 96) ? { hostname: safeString(node.hostname, 96) } : {}),
    gpu_count: gpus.length,
    ...(gpuUsed.length ? { gpu_memory_used_mib: gpuUsed.reduce((sum, value) => sum + value, 0) } : {}),
    ...(gpuTotal.length ? { gpu_memory_total_mib: gpuTotal.reduce((sum, value) => sum + value, 0) } : {}),
    ...(gpuUtil.length ? { max_gpu_utilization_percent: Math.max(...gpuUtil) } : {}),
    disk_count: disks.length,
    ...(diskUse.length ? { max_disk_used_percent: Math.max(...diskUse) } : {}),
    platform_state: "unknown",
    ...(name === "HAMMER" ? { desired_platform: "linux" } : {}),
  };
}

function sourceSummary(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const out: Record<string, unknown> = { state: normalizeState(source.state) };
  const reason = safeReason(source.reason);
  if (reason) out.reason = reason;
  for (const key of ["http_status", "depth", "total", "pod_count"] as const) {
    const number = finiteNumber(source[key]);
    if (number !== undefined) out[key] = number;
  }
  return out;
}

function quenchSummary(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const rows = Array.isArray(source.disks) ? source.disks.filter(isRecord).slice(0, 32) : [];
  let totalBytes = 0;
  let freeBytes = 0;
  for (const row of rows) {
    totalBytes += finiteNumber(row.total_bytes ?? row.Size) ?? 0;
    freeBytes += finiteNumber(row.free_bytes ?? row.FreeSpace) ?? 0;
  }
  return {
    state: normalizeState(source.state),
    ...(safeReason(source.reason) ? { reason: safeReason(source.reason) } : {}),
    disk_count: rows.length,
    total_bytes: totalBytes,
    free_bytes: freeBytes,
  };
}

export function sanitizeFleetSnapshot(value: unknown): Record<string, unknown> & { nodes: SafeFleetNode[] } {
  const root = isRecord(value) ? value : {};
  const rawNodes = Array.isArray(root.nodes) ? root.nodes : [];
  const byName = new Map<string, unknown>();
  for (const node of rawNodes) {
    if (!isRecord(node)) continue;
    const name = safeString(node.name, 24)?.toUpperCase();
    if (name && FLEET_NODES.includes(name as typeof FLEET_NODES[number])) byName.set(name, node);
  }
  const nodes = FLEET_NODES.map((name) => sanitizeNode(byName.get(name), name));
  const training = isRecord(root.training) ? root.training : {};
  return {
    state: nodes.some((node) => node.state === "down" || node.state === "degraded")
      ? "degraded"
      : nodes.every((node) => node.state === "ok")
        ? "ok"
        : "unknown",
    observed_at: new Date().toISOString(),
    nodes,
    quench: quenchSummary(root.quench),
    minio: sourceSummary(root.minio),
    queue: sourceSummary(root.queue),
    training: {
      anvil: sourceSummary(training.anvil),
      local: sourceSummary(training.local),
      runpod: sourceSummary(training.runpod),
    },
    truth_policy: "No fixture fallback; missing measurements remain unknown or blocked.",
  };
}

function resolveLiveOpsCli(): string | null {
  const root = normalize(join(homedir(), ".codex", "plugins", "cache", "personal", "echo-live-ops-overlay"));
  if (!existsSync(root)) return null;
  try {
    const versions = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[0-9A-Za-z.+_-]+$/.test(entry.name))
      .map((entry) => ({ name: entry.name, path: join(root, entry.name, "mcp-server", "dist", "cli.js") }))
      .filter((entry) => existsSync(entry.path) && statSync(entry.path).isFile())
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
    if (!versions[0]) return null;
    const resolvedRoot = realpathSync(root);
    const resolvedCli = realpathSync(versions[0].path);
    const relation = relative(resolvedRoot, resolvedCli);
    return relation.startsWith("..") || relation.includes("\0") ? null : resolvedCli;
  } catch {
    return null;
  }
}

export async function collectFleetSnapshot(runner: CommandRunner = runBoundedCommand): Promise<Record<string, unknown>> {
  const cli = resolveLiveOpsCli();
  if (!cli) {
    return sanitizeFleetSnapshot({
      nodes: FLEET_NODES.map((name) => ({ name, state: "unknown", reason: "collector_command_failed" })),
      quench: { state: "unknown", reason: "collector_command_failed" },
    });
  }
  const result = await runner(process.execPath, [cli], { timeout_ms: 20_000, max_output_bytes: 1_048_576 });
  if (result.exit_code !== 0 || result.timed_out || result.output_limited || result.spawn_error) {
    const failure = classifyCommandFailure(result);
    return {
      ...sanitizeFleetSnapshot({ nodes: FLEET_NODES.map((name) => ({ name, ...failure })) }),
      collector: failure,
      duration_ms: result.duration_ms,
    };
  }
  try {
    return { ...sanitizeFleetSnapshot(JSON.parse(result.stdout) as unknown), collector: { state: "ok" }, duration_ms: result.duration_ms };
  } catch {
    return {
      ...sanitizeFleetSnapshot({ nodes: FLEET_NODES.map((name) => ({ name, state: "unknown", reason: "collector_command_failed" })) }),
      collector: { state: "degraded", reason: "invalid_json" },
      duration_ms: result.duration_ms,
    };
  }
}
