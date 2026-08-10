import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { desktopAction, desktopStatus, desktopTargets } from "../src/tools.ts";

describe("echo-desktop-ops", () => {
  it("status live", () => {
    assert.equal(desktopStatus().status, "live");
  });
  it("lists targets", () => {
    assert.ok(desktopTargets().count >= 3);
  });
  it("mutate requires EXECUTE", () => {
    const r = desktopAction("desktop.focus_target", "desk_forge_console");
    assert.equal(r.ok, false);
  });
  it("focus with EXECUTE", () => {
    const r = desktopAction("desktop.focus_target", "desk_forge_console", undefined, "EXECUTE");
    assert.equal(r.ok, true);
  });
  it("screenshot meta has no pixels", () => {
    const r = desktopAction("desktop.screenshot_meta", "desk_forge_console");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.detail.captured, false);
  });
});
