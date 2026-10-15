import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONTROL_DECK_HTML } from "../src/ui/control-deck.ts";

describe("control deck MCP App", () => {
  it("renders the required operational surfaces and the standards bridge", () => {
    for (const label of ["RAM", "QUENCH GPU", "CRUCIBLE", "OpenClaw", "ECHO SDK", "Vault", "CertForge", "GitHub", "Swarm"]) {
      assert.ok(CONTROL_DECK_HTML.includes(label), label);
    }
    assert.ok(CONTROL_DECK_HTML.includes("ui/initialize"));
    assert.ok(CONTROL_DECK_HTML.includes("ui/notifications/tool-result"));
    assert.ok(CONTROL_DECK_HTML.includes("tools/call"));
  });

  it("ships as a self-contained component without remote scripts", () => {
    assert.equal(/<script[^>]+src=/i.test(CONTROL_DECK_HTML), false);
    assert.equal(/https?:\/\//i.test(CONTROL_DECK_HTML), false);
  });
});
