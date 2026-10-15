import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectLocalSystem } from "../src/adapters/local-system.ts";
import { sanitizeFleetSnapshot } from "../src/adapters/fleet.ts";
import { buildRequestedModelMatrix } from "../src/models.ts";

describe("desktop snapshot components", () => {
  it("reports measured RAM totals and usage", () => {
    const system = collectLocalSystem();
    assert.equal(system.state, "ok");
    assert.ok(system.memory.total_bytes > 0);
    assert.ok(system.memory.used_bytes >= 0);
    assert.ok(system.memory.used_percent >= 0 && system.memory.used_percent <= 100);
  });

  it("preserves node timeout and auth failure states without fixture fallback", () => {
    const result = sanitizeFleetSnapshot({
      overall: "partial",
      nodes: [
        { name: "FORGE", state: "ok", hostname: "forge" },
        { name: "CRUCIBLE", state: "unknown", reason: "connection_timed_out" },
        { name: "HAMMER", state: "blocked", reason: "authentication_failed" },
      ],
      quench: { state: "ok", disks: [{ mount: "C:", total_bytes: 100, free_bytes: 25 }] },
      queue: { state: "unknown", reason: "endpoint_not_configured" },
    });

    assert.equal(result.nodes.find((node) => node.name === "CRUCIBLE")?.reason, "connection_timed_out");
    assert.equal(result.nodes.find((node) => node.name === "HAMMER")?.state, "blocked");
    assert.equal(JSON.stringify(result).includes("1920"), false);
  });

  it("does not promote a requested model without a measured catalog match", () => {
    const matrix = buildRequestedModelMatrix(
      [{ id: "gpt-6.1-sol", display_name: "GPT-6.1 SOL", hidden: false }],
      [{ id: "ollama/qwen3.8:27b", name: "Qwen 3.8 27B", provider: "ollama", available: true }],
    );
    assert.equal(matrix.find((item) => item.requested === "SOL 6.1")?.catalog_state, "matched");
    assert.equal(matrix.find((item) => item.requested === "Qwen 3.8 27B")?.catalog_state, "matched");
    assert.equal(matrix.find((item) => item.requested === "Grok 4.7")?.catalog_state, "unverified");
    assert.ok(matrix.every((item) => item.inference_verified === false));
  });
});
