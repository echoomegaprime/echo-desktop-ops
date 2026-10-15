import type { ToolDef } from "./lib/mcp-http.js";

export const DESKTOP_TARGETS = [
  { id: "desk_forge_console", label: "FORGE console workspace", node: "FORGE", state: "unknown" },
  { id: "desk_anvil_hub", label: "ANVIL hub desktop", node: "ANVIL", state: "unknown" },
  { id: "desk_hammer_batch", label: "HAMMER batch desk", node: "HAMMER", state: "unknown" },
  { id: "desk_temper_overflow", label: "TEMPER overflow desk", node: "TEMPER", state: "unknown" },
  { id: "desk_crucible_auth", label: "CRUCIBLE authorization boundary", node: "CRUCIBLE", state: "unknown" },
] as const;

export const DESKTOP_ACTIONS = [
  { id: "desktop.focus_target", supported: false, reason: "no_verified_focus_adapter" },
  { id: "desktop.notify", supported: false, reason: "no_verified_notification_adapter" },
  { id: "desktop.screenshot_meta", supported: false, reason: "no_verified_capture_adapter" },
  { id: "desktop.list_windows_meta", supported: false, reason: "no_verified_window_inventory_adapter" },
] as const;

export function desktopStatus() {
  return {
    status: "ready",
    bundle: "echo-desktop-ops",
    version: "2.0.0",
    targets: DESKTOP_TARGETS.length,
    actions: 0,
    deprecated_actions: DESKTOP_ACTIONS.length,
    truth_policy: "measured_states_only",
    policy: {
      no_raw_shell: true,
      no_secret_return: true,
      no_pixel_buffer_to_model: true,
      no_synthetic_success: true,
      signed_desktop_package_modified: false,
    },
  };
}

export function desktopTargets() {
  return { targets: DESKTOP_TARGETS, count: DESKTOP_TARGETS.length, state_meaning: "unknown means not measured" };
}

export function desktopActions() {
  return { actions: DESKTOP_ACTIONS, supported_count: 0 };
}

export function desktopAction(actionId: string, targetId?: string, _message?: string, _confirm?: string) {
  const action = DESKTOP_ACTIONS.find((candidate) => candidate.id === actionId);
  if (!action) return { ok: false as const, error: "unknown_action", allowed: DESKTOP_ACTIONS.map((candidate) => candidate.id) };
  if (targetId && !DESKTOP_TARGETS.some((target) => target.id === targetId)) return { ok: false as const, error: "unknown_target" };
  return {
    ok: false as const,
    error: "unsupported_no_verified_adapter",
    action_id: actionId,
    target_id: targetId ?? null,
    reason: action.reason,
    applied: false,
    migration: "Use echo_desktop_snapshot for measured state. A future control adapter must publish execution and readback evidence.",
  };
}

export const tools: ToolDef[] = [
  {
    name: "desktop_status",
    description: "Legacy connector status. Does not claim live target state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => desktopStatus(),
  },
  {
    name: "desktop_targets",
    description: "List named desktop targets without inventing health.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => desktopTargets(),
  },
  {
    name: "desktop_actions",
    description: "List deprecated synthetic actions and their disabled state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => desktopActions(),
  },
  {
    name: "desktop_action",
    description: "Compatibility endpoint that rejects unverified desktop control actions.",
    inputSchema: {
      type: "object",
      properties: {
        action_id: { type: "string" },
        target_id: { type: "string" },
        message: { type: "string" },
        confirm: { type: "string" },
      },
      required: ["action_id"],
      additionalProperties: false,
    },
    handler: (args) => desktopAction(
      String(args.action_id ?? ""),
      args.target_id != null ? String(args.target_id) : undefined,
      args.message != null ? String(args.message) : undefined,
      args.confirm != null ? String(args.confirm) : undefined,
    ),
  },
];
