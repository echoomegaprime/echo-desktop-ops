import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenClawArgs,
  classifyOpenClawJsonError,
  sanitizeOpenClawHealth,
  sanitizeOpenClawModelStatus,
  sanitizeOpenClawModels,
} from "../src/adapters/openclaw.ts";

describe("OpenClaw adapter", () => {
  it("maps only fixed read-only operations to CLI arguments", () => {
    assert.deepEqual(buildOpenClawArgs("health"), ["health", "--json", "--timeout", "30000"]);
    assert.deepEqual(buildOpenClawArgs("models"), ["models", "list", "--json"]);
    assert.deepEqual(buildOpenClawArgs("config_validate"), ["config", "validate", "--json"]);
    assert.throws(() => buildOpenClawArgs("shell" as never), /unsupported_openclaw_operation/);
  });

  it("preserves specific structured gateway and catalog failures", () => {
    assert.deepEqual(classifyOpenClawJsonError(JSON.stringify({
      ok: false,
      error: { type: "gateway_transport_error", kind: "timeout", message: "Gateway not reachable after waiting 10 s." },
    })), { state: "unknown", reason: "gateway_health_timeout" });
    assert.deepEqual(classifyOpenClawJsonError(JSON.stringify({
      ok: false,
      error: { type: "cli_error", message: "Model catalog is not ready." },
    })), { state: "unknown", reason: "published_model_catalog_unavailable" });
  });

  it("allowlists health fields and drops sessions, identifiers, paths, and tokens", () => {
    const result = sanitizeOpenClawHealth({
      ok: true,
      version: "2026.9.6",
      durationMs: 63,
      sessions: [{ sessionKey: "private", transcriptPath: "C:/secret" }],
      tokenSource: "private",
      plugins: {
        loaded: ["openai", "anthropic", "ollama"],
        errors: [{ id: "broken", error: "secret path C:/private" }],
      },
      channels: {
        discord: { configured: true, running: true, connected: true, botId: "123", token: "private" },
      },
      eventLoop: { degraded: false, delayP99Ms: 3.2, secret: "drop" },
      deliveryQueues: {
        outbound: { prepared: 26, failed: 2, items: [{ payload: "drop" }] },
        ingress: { failed: 1 },
      },
    });

    assert.equal(result.state, "degraded");
    assert.equal(result.ok, true);
    assert.deepEqual(result.plugins.loaded, ["anthropic", "ollama", "openai"]);
    assert.equal(result.plugins.error_count, 1);
    assert.deepEqual(result.channels, [{ name: "discord", configured: true, running: true, connected: true }]);
    assert.deepEqual(result.delivery_queues, { failed: 3, pending: 26 });
    const serialized = JSON.stringify(result);
    for (const forbidden of ["sessionKey", "transcriptPath", "tokenSource", "botId", "private", "payload"]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  });

  it("returns only safe model catalog facts and never auth material", () => {
    const result = sanitizeOpenClawModels({
      models: [
        { id: "ollama/qwen3:27b", name: "Qwen 3 27B", provider: "ollama", available: true, contextWindow: 32768, apiKey: "drop" },
        { key: "xai/grok", label: "Grok", provider: "xai", configured: true, auth: { token: "drop" } },
      ],
      auth: { profiles: [{ token: "drop" }] },
    });

    assert.equal(result.count, 2);
    assert.equal(result.models[0]?.id, "ollama/qwen3:27b");
    assert.equal(JSON.stringify(result).includes("drop"), false);
    assert.equal(JSON.stringify(result).includes("auth"), false);
  });

  it("falls back to configured model references without exposing auth stores", () => {
    const result = sanitizeOpenClawModelStatus({
      configPath: "C:/private/config.json",
      defaultModel: "ollama/qwen3.8:27b",
      resolvedDefault: "ollama/qwen3.8:27b",
      fallbacks: ["anthropic/claude-opus-4.8"],
      aliases: { Grok: "xai/grok-4.7" },
      auth: { storePath: "C:/private/auth.json", providers: [{ token: "drop" }] },
    });
    assert.equal(result.catalog_kind, "configured_routes_fallback");
    assert.deepEqual(result.models.map((model) => model.id), ["anthropic/claude-opus-4.8", "ollama/qwen3.8:27b", "xai/grok-4.7"]);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("configPath"), false);
    assert.equal(serialized.includes("auth"), false);
    assert.equal(serialized.includes("private"), false);
  });
});
