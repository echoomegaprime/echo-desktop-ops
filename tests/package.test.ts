import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<string, unknown>;

describe("Codex plugin package", () => {
  it("keeps package and plugin versions aligned", () => {
    const pkg = readJson("package.json");
    const portable = readJson("plugin.json");
    const compatibility = readJson(".codex-plugin/plugin.json");
    assert.equal(portable.name, "echo-desktop-ops");
    assert.equal(portable.version, pkg.version);
    assert.equal(compatibility.version, pkg.version);
    assert.equal(compatibility.skills, "./skills/");
    assert.equal(compatibility.mcpServers, "./.mcp.json");
    assert.equal(compatibility.requires_local_executor, true);
  });

  it("launches only the packaged stdio server with relative arguments", () => {
    const compatibility = readJson(".mcp.json");
    const compatibilityServers = compatibility.mcpServers as Record<string, Record<string, unknown>>;
    assert.equal(compatibilityServers["echo-desktop-ops"]?.command, "node");
    assert.deepEqual(compatibilityServers["echo-desktop-ops"]?.args, ["./dist/stdio.js"]);
    const portable = readJson("mcp.json");
    const portableServers = portable.mcpServers as Record<string, Record<string, unknown>>;
    assert.equal(portableServers["echo-desktop-ops"]?.type, "stdio");
    assert.deepEqual(portableServers["echo-desktop-ops"]?.args, ["${PLUGIN_ROOT}/dist/stdio.js"]);
    assert.equal(portableServers["echo-desktop-ops"]?.cwd, "${PLUGIN_ROOT}");
    assert.equal(JSON.stringify({ portable, compatibility }).includes("C:\\"), false);
  });

  it("packages the four expected workflow skills", () => {
    for (const name of ["echo-control-deck", "openclaw-desktop", "echo-model-routing", "echo-build-gates"]) {
      const text = readFileSync(resolve(root, "skills", name, "SKILL.md"), "utf8");
      assert.match(text, /^---\r?\nname:/);
      assert.match(text, /\r?\ndescription:/);
    }
  });

  it("provides a deterministic production-dependency staging script", () => {
    const pkg = readJson("package.json");
    const scripts = pkg.scripts as Record<string, string>;
    assert.equal(scripts["package:stage"], "node scripts/stage-plugin.mjs");
    const staging = readFileSync(resolve(root, "scripts", "stage-plugin.mjs"), "utf8");
    assert.match(staging, /npm-cli\.js/);
    assert.match(staging, /--omit=dev/);
    assert.match(staging, /unsafe_staging_path/);
  });
});
