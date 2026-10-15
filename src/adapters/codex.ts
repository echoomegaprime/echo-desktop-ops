import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { classifyCommandFailure, runBoundedCommand, type CommandRunner } from "../lib/process.js";
import { isRecord, safeString, type SourceState } from "../types.js";

export type SafeNativeModel = {
  id: string;
  model: string;
  display_name: string;
  hidden: boolean;
  is_default: boolean;
  reasoning_efforts: string[];
};

function resolveCodexExe(): string | null {
  const candidates = process.platform === "win32"
    ? [join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Programs", "OpenAI", "Codex", "bin", "codex.exe")]
    : ["/usr/local/bin/codex", "/usr/bin/codex"];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try { return realpathSync(candidate); } catch { /* continue */ }
  }
  return null;
}

function sanitizeModelList(value: unknown): SafeNativeModel[] {
  const root = isRecord(value) ? value : {};
  const rows = Array.isArray(root.data) ? root.data : [];
  const models: SafeNativeModel[] = [];
  for (const row of rows.slice(0, 256)) {
    if (!isRecord(row)) continue;
    const id = safeString(row.id, 160);
    const model = safeString(row.model, 160);
    const displayName = safeString(row.displayName, 160);
    if (!id || !model || !displayName) continue;
    const efforts = Array.isArray(row.supportedReasoningEfforts)
      ? row.supportedReasoningEfforts.map((item) => isRecord(item) ? safeString(item.reasoningEffort ?? item.effort, 32) : safeString(item, 32)).filter((item): item is string => Boolean(item)).slice(0, 16)
      : [];
    models.push({
      id,
      model,
      display_name: displayName,
      hidden: row.hidden === true,
      is_default: row.isDefault === true,
      reasoning_efforts: efforts,
    });
  }
  return models;
}

export async function collectNativeModelCatalog(timeoutMs = 12_000): Promise<Record<string, unknown> & { models: SafeNativeModel[] }> {
  const executable = resolveCodexExe();
  if (!executable) return { state: "unknown", reason: "codex_executable_not_found", models: [] };
  const started = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(executable, ["app-server", "--listen", "stdio://"], {
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "";
    let stderr = "";
    let settled = false;
    const finish = (value: Record<string, unknown> & { models: SafeNativeModel[] }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(value);
    };
    const timer = setTimeout(() => finish({ state: "unknown", reason: "codex_model_list_timed_out", models: [], duration_ms: Date.now() - started }), timeoutMs);
    timer.unref();

    child.on("error", () => finish({ state: "unknown", reason: "codex_app_server_spawn_failed", models: [], duration_ms: Date.now() - started }));
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 32_768) stderr += chunk.toString("utf8").slice(0, 32_768 - stderr.length);
    });
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 1_048_576) {
        finish({ state: "degraded", reason: "codex_model_list_output_limit", models: [], duration_ms: Date.now() - started });
        return;
      }
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          try {
            const message = JSON.parse(line) as unknown;
            if (isRecord(message) && message.id === 2) {
              if (isRecord(message.error)) {
                const state: SourceState = /auth|login|unauthor/i.test(stderr) ? "blocked" : "unknown";
                finish({ state, reason: state === "blocked" ? "codex_auth_required" : "codex_model_list_failed", models: [], duration_ms: Date.now() - started });
                return;
              }
              const models = sanitizeModelList(message.result);
              finish({ state: models.length ? "ok" : "unknown", models, count: models.length, catalog_only: true, duration_ms: Date.now() - started, observed_at: new Date().toISOString() });
              return;
            }
          } catch {
            // Ignore non-JSON diagnostics and continue waiting for request id 2.
          }
        }
        newline = buffer.indexOf("\n");
      }
    });
    child.on("close", () => {
      if (!settled) finish({ state: /auth|login|unauthor/i.test(stderr) ? "blocked" : "unknown", reason: "codex_app_server_closed", models: [], duration_ms: Date.now() - started });
    });

    const initialize = {
      id: 1,
      method: "initialize",
      params: {
        clientInfo: { name: "echo-desktop-ops", title: "ECHO Desktop Ops", version: "2.0.0" },
        capabilities: null,
      },
    };
    const modelList = { id: 2, method: "model/list", params: { limit: 256, includeHidden: false } };
    child.stdin.write(`${JSON.stringify(initialize)}\n`);
    child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
    child.stdin.write(`${JSON.stringify(modelList)}\n`);
  });
}

const MCP_SERVICES: Record<string, string> = {
  "echo-sdk": "ECHO SDK",
  "echo-swarm": "Swarm",
  "echo-nexus": "ECHO Nexus",
  "ecf-write-acceptance": "ECF",
  "echo-github-autonomy": "GitHub",
  "echo-continuity-fabric": "Continuity Fabric",
  "echo-live-ops-overlay": "Live Ops",
  "echo-personality-forge": "Personality Forge",
};

export async function collectCodexMcpRegistrations(runner: CommandRunner = runBoundedCommand): Promise<Record<string, unknown>> {
  const executable = resolveCodexExe();
  if (!executable) return { state: "unknown", reason: "codex_executable_not_found", services: [] };
  const result = await runner(executable, ["mcp", "list"], { timeout_ms: 10_000, max_output_bytes: 524_288 });
  if (result.exit_code !== 0 || result.timed_out || result.output_limited || result.spawn_error) {
    return { ...classifyCommandFailure(result), services: [], duration_ms: result.duration_ms };
  }
  const text = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const services = Object.entries(MCP_SERVICES).map(([id, label]) => {
    const line = text.split(/\r?\n/).find((candidate) => candidate.trimStart().startsWith(`${id} `));
    if (!line) return { id, label, state: "unknown" as const, reason: "not_registered" };
    const match = line.match(/\s(enabled|disabled)\s+(.+?)\s*$/i);
    const registration = match?.[1]?.toLowerCase() === "enabled" ? "enabled" : "disabled";
    const auth = match?.[2]?.trim().slice(0, 48) ?? "unknown";
    if (registration === "disabled") return { id, label, state: "down" as const, registration, auth: "not_applicable", reason: "disabled" };
    if (/not logged in/i.test(auth)) return { id, label, state: "blocked" as const, registration, auth: "not_logged_in", reason: "authentication_required" };
    return { id, label, state: "unknown" as const, registration, auth: auth === "Unsupported" ? "not_declared" : "configured", reason: "registered_not_health_checked" };
  });
  return { state: "ok", services, observed_at: new Date().toISOString(), duration_ms: result.duration_ms };
}
