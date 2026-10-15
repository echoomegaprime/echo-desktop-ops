import type { SafeExternalModel } from "./adapters/openclaw.js";
import type { SafeNativeModel } from "./adapters/codex.js";

type RequestedModel = {
  requested: string;
  route: "native_codex" | "external_supervised";
  queries: string[];
};

const REQUESTED_MODELS: RequestedModel[] = [
  { requested: "Astra", route: "native_codex", queries: ["astra"] },
  { requested: "SOL 6.1", route: "native_codex", queries: ["sol61", "61sol"] },
  { requested: "Qwen 3.8 27B", route: "external_supervised", queries: ["qwen3827b"] },
  { requested: "Claude Sonnet 5.5", route: "external_supervised", queries: ["claudesonnet55", "sonnet55"] },
  { requested: "Claude Opus 5.5", route: "external_supervised", queries: ["claudeopus55", "opus55"] },
  { requested: "Claude Opus 4.8", route: "external_supervised", queries: ["claudeopus48", "opus48"] },
  { requested: "Fable 5.1", route: "external_supervised", queries: ["fable51"] },
  { requested: "Grok 4.7", route: "external_supervised", queries: ["grok47"] },
];

function normalize(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

export function buildRequestedModelMatrix(nativeModels: SafeNativeModel[], externalModels: SafeExternalModel[]) {
  return REQUESTED_MODELS.map((request) => {
    const candidates = request.route === "native_codex"
      ? nativeModels.map((model) => ({ id: model.id, text: normalize(`${model.id} ${model.model} ${model.display_name}`) }))
      : externalModels.map((model) => ({ id: model.id, text: normalize(`${model.id} ${model.name ?? ""} ${model.provider ?? ""}`) }));
    const matched = candidates.filter((candidate) => request.queries.some((query) => candidate.text.includes(query))).slice(0, 5);
    return {
      requested: request.requested,
      route: request.route,
      catalog_state: matched.length ? "matched" as const : "unverified" as const,
      matched_ids: matched.map((item) => item.id),
      catalog_source: request.route === "native_codex" ? "codex_model_list" : "openclaw_model_catalog",
      inference_verified: false as const,
      note: matched.length
        ? "Catalog presence only; a successful inference is still required."
        : "No measured catalog match; no selector entry or callable route is claimed.",
    };
  });
}
