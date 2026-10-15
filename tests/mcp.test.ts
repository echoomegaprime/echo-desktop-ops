import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDesktopOpsServer } from "../src/server.ts";
import { CONTROL_DECK_URI } from "../src/ui/control-deck.ts";

describe("MCP contract", () => {
  let client: Client | undefined;
  let server: McpServer | undefined;

  afterEach(async () => {
    await client?.close();
    await server?.close();
  });

  async function connect() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = createDesktopOpsServer();
    client = new Client({ name: "echo-desktop-ops-test", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  }

  it("initializes and publishes the governed tool set", async () => {
    const connected = await connect();
    const result = await connected.listTools();
    assert.deepEqual(result.tools.map((tool) => tool.name).sort(), [
      "echo_desktop_get_contract",
      "echo_desktop_snapshot",
      "echo_native_model_catalog",
      "echo_openclaw_readonly",
      "echo_requested_model_matrix",
      "echo_swarm_readiness",
    ]);
  });

  it("publishes a self-contained MCP App resource", async () => {
    const connected = await connect();
    const listed = await connected.listResources();
    assert.ok(listed.resources.some((resource) => resource.uri === CONTROL_DECK_URI));
    const resource = await connected.readResource({ uri: CONTROL_DECK_URI });
    assert.equal(resource.contents[0]?.mimeType, "text/html;profile=mcp-app");
    assert.ok("text" in resource.contents[0]! && resource.contents[0].text.includes("ECHO Desktop Control Deck"));
  });

  it("returns the truth contract without external calls", async () => {
    const connected = await connect();
    const result = await connected.callTool({ name: "echo_desktop_get_contract", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.equal((result.structuredContent as Record<string, unknown>).schema, "echo.desktop.contract.v2");
  });

  it("rejects an arbitrary OpenClaw operation at the schema boundary", async () => {
    const connected = await connect();
    const result = await connected.callTool({ name: "echo_openclaw_readonly", arguments: { operation: "shell" } });
    assert.equal(result.isError, true);
  });
});
