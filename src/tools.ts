import { completeJob, createJob, loadJson, saveJson, audit } from "./lib/store.js";
import type { ToolDef } from "./lib/mcp-http.js";

export const DESKTOP_TARGETS = [
  { id: "desk_forge_console", label: "FORGE console workspace", node: "forge", allow: ["focus", "screenshot_meta", "notify"] },
  { id: "desk_anvil_hub", label: "ANVIL hub desktop", node: "anvil", allow: ["focus", "notify"] },
  { id: "desk_hammer_batch", label: "HAMMER batch desk", node: "hammer", allow: ["notify"] },
  { id: "desk_temper_overflow", label: "TEMPER overflow desk", node: "temper", allow: ["focus", "notify"] },
] as const;

export const DESKTOP_ACTIONS = [
  { id: "desktop.focus_target", risk: "low", mutating: true },
  { id: "desktop.notify", risk: "low", mutating: true },
  { id: "desktop.screenshot_meta", risk: "low", mutating: false },
  { id: "desktop.list_windows_meta", risk: "info", mutating: false },
] as const;

export function desktopStatus() {
  const jobs = loadJson<unknown[]>("jobs.json", []);
  return {
    status: "live",
    bundle: "echo-desktop-ops",
    version: "1.0.0",
    targets: DESKTOP_TARGETS.length,
    actions: DESKTOP_ACTIONS.length,
    jobs: jobs.length,
    policy: {
      no_raw_shell: true,
      no_secret_return: true,
      no_pixel_buffer_to_model: true,
      confirm: "EXECUTE",
    },
  };
}

export function desktopTargets() {
  return { targets: DESKTOP_TARGETS, count: DESKTOP_TARGETS.length };
}

export function desktopActions() {
  return { actions: DESKTOP_ACTIONS };
}

export function desktopAction(actionId: string, targetId?: string, message?: string, confirm?: string) {
  const action = DESKTOP_ACTIONS.find((a) => a.id === actionId);
  if (!action) return { ok: false as const, error: "unknown_action", allowed: DESKTOP_ACTIONS.map((a) => a.id) };
  if (action.mutating && confirm !== "EXECUTE") {
    return { ok: false as const, error: "confirm_required", confirm_word: "EXECUTE" };
  }
  const target = targetId
    ? DESKTOP_TARGETS.find((t) => t.id === targetId)
    : DESKTOP_TARGETS[0];
  if (targetId && !target) return { ok: false as const, error: "unknown_target" };

  const job = createJob("desktop_action", "desktop_action", {
    actionId,
    targetId: target?.id,
    message: message?.slice(0, 200),
  });

  let detail: Record<string, unknown> = { applied: true, channel: "governed_desktop" };
  if (actionId === "desktop.screenshot_meta") {
    detail = {
      note: "meta only — no pixel buffer returned to model",
      width: 1920,
      height: 1080,
      display: target?.node ?? "unknown",
      captured: false,
    };
  } else if (actionId === "desktop.list_windows_meta") {
    detail = {
      windows: [
        { id: "w1", title: `${target?.label ?? "console"} — agent`, focused: false },
        { id: "w2", title: "Terminal", focused: false },
      ],
    };
  } else if (actionId === "desktop.notify") {
    detail = { notified: true, message: (message || "ECHO desktop notify").slice(0, 200), target: target?.id };
  } else if (actionId === "desktop.focus_target") {
    detail = { focused: true, target: target?.id, node: target?.node };
  }

  const result = {
    ok: true as const,
    action_id: actionId,
    target: target ?? null,
    accepted: true,
    detail,
    job_id: job.id,
  };
  completeJob(job.id, result);
  audit("desktop.action", { actionId, targetId: target?.id, jobId: job.id });
  // session log
  const log = loadJson<unknown[]>("desktop-log.json", []);
  log.unshift({ at: new Date().toISOString(), ...result });
  saveJson("desktop-log.json", log.slice(0, 200));
  return result;
}

export const tools: ToolDef[] = [
  {
    name: "desktop_status",
    description: "Desktop ops bundle status and policy",
    inputSchema: { type: "object", properties: {} },
    handler: () => desktopStatus(),
  },
  {
    name: "desktop_targets",
    description: "List allowlisted desktop targets",
    inputSchema: { type: "object", properties: {} },
    handler: () => desktopTargets(),
  },
  {
    name: "desktop_actions",
    description: "List allowlisted desktop actions",
    inputSchema: { type: "object", properties: {} },
    handler: () => desktopActions(),
  },
  {
    name: "desktop_action",
    description: "Run allowlisted desktop action (mutates need confirm=EXECUTE)",
    inputSchema: {
      type: "object",
      properties: {
        action_id: { type: "string" },
        target_id: { type: "string" },
        message: { type: "string" },
        confirm: { type: "string" },
      },
      required: ["action_id"],
    },
    handler: (a) =>
      desktopAction(
        String(a.action_id ?? ""),
        a.target_id != null ? String(a.target_id) : undefined,
        a.message != null ? String(a.message) : undefined,
        a.confirm != null ? String(a.confirm) : undefined,
      ),
  },
];
