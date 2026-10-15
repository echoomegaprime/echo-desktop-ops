import { createHash } from "node:crypto";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { collectCodexMcpRegistrations, collectNativeModelCatalog, type SafeNativeModel } from "./adapters/codex.js";
import { runOpenClawReadOnly, type SafeExternalModel } from "./adapters/openclaw.js";
import { diagnostic, requestId } from "./lib/logger.js";
import { buildRequestedModelMatrix } from "./models.js";
import { collectDesktopSnapshot } from "./snapshot.js";
import { isRecord } from "./types.js";
import { CONTROL_DECK_HTML, CONTROL_DECK_URI } from "./ui/control-deck.js";

function reply(structuredContent: Record<string, unknown>, text: string) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

function userColor(extra: unknown): string {
  if (!isRecord(extra) || !isRecord(extra._meta)) return "#8b5cf6";
  const subject = extra._meta["openai/subject"];
  if (typeof subject !== "string" || !subject) return "#8b5cf6";
  const digest = createHash("sha256").update(subject).digest();
  const rgb = [digest[0], digest[1], digest[2]].map((value) => 96 + (value % 128));
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function extractNativeModels(value: Record<string, unknown>): SafeNativeModel[] {
  return Array.isArray(value.models) ? value.models as SafeNativeModel[] : [];
}

function extractExternalModels(value: Record<string, unknown>): SafeExternalModel[] {
  return Array.isArray(value.models) ? value.models as SafeExternalModel[] : [];
}

export function createDesktopOpsServer(): McpServer {
  const server = new McpServer({ name: "echo-desktop-ops", version: "2.0.0" });

  registerAppResource(
    server,
    "echo-desktop-control-deck",
    CONTROL_DECK_URI,
    {},
    async () => ({
      contents: [{
        uri: CONTROL_DECK_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: CONTROL_DECK_HTML,
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
          },
          "openai/ui": { availableDisplayModes: ["inline", "fullscreen", "pip"] },
          "openai/widgetDescription": "Measured ECHO Desktop operations deck with RAM, GPU, fleet, OpenClaw, service, model-route, GitHub, and CertForge state.",
          "openai/widgetPrefersBorder": true,
          "openai/widgetCSP": { connect_domains: [], resource_domains: [], frame_domains: [], redirect_domains: [] },
        },
      }],
    }),
  );

  server.registerTool(
    "echo_desktop_get_contract",
    {
      title: "Get ECHO Desktop truth contract",
      description: "Return state meanings, safety boundaries, supported UI surface, and model-routing rules without contacting external systems.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => reply({
      schema: "echo.desktop.contract.v2",
      states: {
        ok: "Measured healthy in the current observation.",
        degraded: "Responded with a measured problem or warning.",
        down: "Measured unavailable.",
        blocked: "A required authorization or policy boundary is not satisfied.",
        unknown: "No trustworthy current measurement.",
      },
      safety: {
        arbitrary_shell: false,
        arbitrary_executable_paths: false,
        arbitrary_urls: false,
        raw_provider_payloads: false,
        secrets_in_logs: false,
        signed_desktop_package_modified: false,
      },
      ui: {
        supported: "MCP App control deck in ChatGPT/Codex",
        app_wide_top_border: "not_supported_by_public_plugin_surface",
        display_modes: ["inline", "fullscreen", "pip"],
      },
      models: {
        native_openai: "Only entries returned by Codex model/list belong in the native selector.",
        external: "External provider models remain supervised tool or Swarm routes.",
        catalog_is_not_inference_proof: true,
      },
      builds: { github_repository_required: true, exact_sha_certforge_required_before_install: true },
    }, "ECHO Desktop truth contract loaded."),
  );

  registerAppTool(
    server,
    "echo_desktop_snapshot",
    {
      title: "Open or refresh ECHO Desktop Control Deck",
      description: "Collect a measured local RAM/GPU, fleet, OpenClaw, MCP registration, and governance snapshot and render the in-desktop control deck.",
      inputSchema: { refresh: z.boolean().optional().default(false) },
      _meta: {
        ui: { resourceUri: CONTROL_DECK_URI },
        "openai/outputTemplate": CONTROL_DECK_URI,
        "openai/widgetAccessible": true,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ refresh }, extra) => {
      const snapshot = await collectDesktopSnapshot({ refresh, user_color: userColor(extra) });
      return reply({ snapshot }, `ECHO Desktop snapshot collected: ${String(snapshot.overall ?? "unknown")}.`);
    },
  );

  server.registerTool(
    "echo_openclaw_readonly",
    {
      title: "Inspect OpenClaw from Codex Desktop",
      description: "Run one bounded, headless, read-only OpenClaw CLI probe. Raw sessions, identifiers, paths, tokens, prompts, and provider payloads are never returned.",
      inputSchema: z.object({ operation: z.enum(["health", "models", "config_validate"]) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ operation }) => {
      const id = requestId();
      diagnostic("openclaw.probe.begin", { request_id: id, operation });
      const result = await runOpenClawReadOnly(operation);
      diagnostic("openclaw.probe.complete", { request_id: id, operation, state: result.state });
      return reply({ operation, result, request_id: id }, `OpenClaw ${operation} probe completed with state ${String(result.state ?? "unknown")}.`);
    },
  );

  server.registerTool(
    "echo_native_model_catalog",
    {
      title: "Read native Codex model catalog",
      description: "Read the current Codex model/list catalog for native selector availability. Catalog presence is not a successful-inference claim.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const catalog = await collectNativeModelCatalog();
      return reply({ catalog }, `Native Codex catalog returned ${String(catalog.models.length)} visible model entries.`);
    },
  );

  server.registerTool(
    "echo_requested_model_matrix",
    {
      title: "Check requested desktop model routes",
      description: "Compare Astra, SOL 6.1, Qwen 3.8 27B, requested Claude variants, Fable 5.1, and Grok 4.7 against measured native and OpenClaw catalogs without making model calls.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const [native, external] = await Promise.all([collectNativeModelCatalog(), runOpenClawReadOnly("models")]);
      const matrix = buildRequestedModelMatrix(extractNativeModels(native), extractExternalModels(external));
      return reply({ native_catalog_state: native.state, external_catalog_state: external.state, matrix }, "Requested model matrix collected. Matches are catalog evidence only; inference remains unverified.");
    },
  );

  server.registerTool(
    "echo_swarm_readiness",
    {
      title: "Check ECHO Swarm readiness",
      description: "Check whether the existing ECHO Swarm MCP route is registered and authorized, without launching providers or consuming model tokens.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const registrations = await collectCodexMcpRegistrations();
      const services = Array.isArray(registrations.services) ? registrations.services : [];
      const swarm = services.find((service) => isRecord(service) && service.id === "echo-swarm") ?? { id: "echo-swarm", state: "unknown", reason: "not_observed" };
      return reply({ swarm, inference_started: false, tokens_consumed: false }, `ECHO Swarm readiness is ${isRecord(swarm) ? String(swarm.state ?? "unknown") : "unknown"}.`);
    },
  );

  return server;
}
