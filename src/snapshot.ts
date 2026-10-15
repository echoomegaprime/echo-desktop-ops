import { collectCodexMcpRegistrations, collectNativeModelCatalog, type SafeNativeModel } from "./adapters/codex.js";
import { collectFleetSnapshot, type SafeFleetNode } from "./adapters/fleet.js";
import { collectLocalGpu } from "./adapters/gpu.js";
import { collectLocalSystem } from "./adapters/local-system.js";
import { runOpenClawReadOnly, type SafeExternalModel } from "./adapters/openclaw.js";
import { diagnostic, requestId } from "./lib/logger.js";
import { buildRequestedModelMatrix } from "./models.js";
import { aggregateState, isRecord, normalizeState, type StatusLight } from "./types.js";

type SnapshotOptions = {
  refresh?: boolean;
  user_color?: string;
};

let cache: { at: number; value: Record<string, unknown> } | null = null;
let externalModelCache: { at: number; value: Record<string, unknown> } | null = null;
const CACHE_MS = 10_000;
const MODEL_CACHE_MS = 300_000;

async function collectExternalModelsCached(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (externalModelCache && now - externalModelCache.at <= MODEL_CACHE_MS) return externalModelCache.value;
  const value = await runOpenClawReadOnly("models");
  externalModelCache = { at: Date.now(), value };
  return value;
}

function serviceLight(id: string, label: string, state: StatusLight["state"], reason: string, group: StatusLight["group"] = "service"): StatusLight {
  return { id, label, group, state, summary: state === "ok" ? "Measured healthy" : reason.replaceAll("_", " "), reason };
}

function findService(registrations: Record<string, unknown>, id: string): Record<string, unknown> | undefined {
  const services = Array.isArray(registrations.services) ? registrations.services : [];
  return services.find((service) => isRecord(service) && service.id === id) as Record<string, unknown> | undefined;
}

function registrationLight(registrations: Record<string, unknown>, id: string, fallbackLabel: string, group: StatusLight["group"] = "service"): StatusLight {
  const service = findService(registrations, id);
  if (!service) return serviceLight(id, fallbackLabel, "unknown", "registration_not_observed", group);
  const state = normalizeState(service.state);
  const reason = typeof service.reason === "string" ? service.reason : "registered_not_health_checked";
  return serviceLight(id, typeof service.label === "string" ? service.label : fallbackLabel, state, reason, group);
}

function fleetLights(fleet: Record<string, unknown>): StatusLight[] {
  const nodes = Array.isArray(fleet.nodes) ? fleet.nodes as SafeFleetNode[] : [];
  return nodes.map((node) => ({
    id: `node-${node.name.toLowerCase()}`,
    label: node.name,
    group: "fleet" as const,
    state: node.state,
    summary: node.state === "ok" ? `${node.gpu_count} GPU(s), ${node.disk_count} disk(s)` : (node.reason ?? "No trustworthy measurement"),
    ...(node.reason ? { reason: node.reason } : {}),
  }));
}

async function collectCoreSnapshot(): Promise<Record<string, unknown>> {
  const id = requestId();
  diagnostic("snapshot.begin", { request_id: id });
  const local = collectLocalSystem();
  const [gpu, fleet, openclaw, registrations, nativeCatalog, externalCatalog] = await Promise.all([
    collectLocalGpu(),
    collectFleetSnapshot(),
    runOpenClawReadOnly("health"),
    collectCodexMcpRegistrations(),
    collectNativeModelCatalog(),
    collectExternalModelsCached(),
  ]);
  const nativeModels = Array.isArray(nativeCatalog.models) ? nativeCatalog.models as SafeNativeModel[] : [];
  const externalModels = Array.isArray(externalCatalog.models) ? externalCatalog.models as SafeExternalModel[] : [];
  const modelMatrix = buildRequestedModelMatrix(nativeModels, externalModels);
  const astra = modelMatrix.find((item) => item.requested === "Astra");
  const sol = modelMatrix.find((item) => item.requested === "SOL 6.1");
  const memoryState = local.memory.used_percent >= 95 ? "degraded" : "ok";
  const gpuState = normalizeState(gpu.state);
  const openClawState = normalizeState(openclaw.state);
  const lights: StatusLight[] = [
    {
      id: "ram",
      label: "RAM",
      group: "local",
      state: memoryState,
      summary: `${local.memory.used_percent.toFixed(1)}% used`,
    },
    {
      id: "quench-gpu",
      label: "QUENCH GPU",
      group: "local",
      state: gpuState,
      summary: gpuState === "ok" ? `${Array.isArray(gpu.gpus) ? gpu.gpus.length : 0} GPU(s) measured` : String(gpu.reason ?? "GPU measurement unavailable"),
      ...(typeof gpu.reason === "string" ? { reason: gpu.reason } : {}),
    },
    ...fleetLights(fleet),
    {
      id: "openclaw",
      label: "OpenClaw",
      group: "service",
      state: openClawState,
      summary: openClawState === "ok" ? "Gateway health measured" : String(openclaw.reason ?? openclaw.status ?? "Health unavailable"),
      ...(typeof openclaw.reason === "string" ? { reason: openclaw.reason } : {}),
    },
    registrationLight(registrations, "echo-sdk", "ECHO SDK"),
    registrationLight(registrations, "ecf-write-acceptance", "ECF"),
    registrationLight(registrations, "echo-swarm", "Swarm", "model"),
    serviceLight("model-astra", "Astra", astra?.catalog_state === "matched" ? "ok" : "unknown", astra?.catalog_state === "matched" ? "native_catalog_match_only" : "native_catalog_match_not_observed", "model"),
    serviceLight("model-sol-6-1", "SOL 6.1", sol?.catalog_state === "matched" ? "ok" : "unknown", sol?.catalog_state === "matched" ? "native_catalog_match_only" : "native_catalog_match_not_observed", "model"),
    registrationLight(registrations, "echo-github-autonomy", "GitHub", "governance"),
    serviceLight("vault", "Vault", "unknown", "health_adapter_not_admitted", "service"),
    serviceLight("gs343", "GS343", "unknown", "health_adapter_not_admitted", "service"),
    serviceLight("certforge", "CertForge", "unknown", "exact_sha_certification_not_observed", "governance"),
  ];
  const overall = aggregateState(lights.map((light) => light.state));
  const value = {
    schema: "echo.desktop.snapshot.v2",
    request_id: id,
    collected_at: new Date().toISOString(),
    overall,
    lights,
    local,
    gpu,
    fleet,
    openclaw,
    registrations,
    native_catalog: nativeCatalog,
    external_catalog: externalCatalog,
    model_matrix: modelMatrix,
    build_policy: {
      github_repo_required: true,
      exact_sha_certforge_required: true,
      current_candidate_certified: false,
      signed_desktop_package_modified: false,
    },
    limitations: {
      app_wide_top_border_supported: false,
      in_chat_control_deck_supported: true,
      native_model_selector_extension_supported: false,
      external_models_are_supervised_routes: true,
    },
    truth_policy: "Every green state requires a current measured result. Registered, configured, installed, and healthy are separate states.",
  };
  diagnostic("snapshot.complete", { request_id: id, overall, light_count: lights.length });
  return value;
}

export async function collectDesktopSnapshot(options: SnapshotOptions = {}): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (!options.refresh && cache && now - cache.at <= CACHE_MS) {
    return {
      ...cache.value,
      cache: { hit: true, age_ms: now - cache.at },
      user: { label: "Local operator", color: options.user_color ?? "#8b5cf6", identity_disclosed: false },
    };
  }
  const value = await collectCoreSnapshot();
  cache = { at: Date.now(), value };
  return {
    ...value,
    cache: { hit: false, age_ms: 0 },
    user: { label: "Local operator", color: options.user_color ?? "#8b5cf6", identity_disclosed: false },
  };
}

export function clearSnapshotCache(): void {
  cache = null;
  externalModelCache = null;
}
