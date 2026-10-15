import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { desktopAction, desktopStatus, desktopTargets } from "../src/tools.ts";

describe("legacy connector compatibility", () => {
  it("does not describe an unmeasured connector as live", () => {
    const status = desktopStatus();
    assert.notEqual(status.status, "live");
    assert.equal(status.truth_policy, "measured_states_only");
  });

  it("lists targets without inventing runtime state", () => {
    const result = desktopTargets();
    assert.ok(result.count >= 5);
    assert.ok(result.targets.every((target) => target.state === "unknown"));
  });

  it("rejects the old synthetic focus action even with confirmation", () => {
    const result = desktopAction("desktop.focus_target", "desk_forge_console", undefined, "EXECUTE");
    assert.equal(result.ok, false);
    assert.equal(result.error, "unsupported_no_verified_adapter");
  });

  it("rejects synthetic screenshot metadata", () => {
    const result = desktopAction("desktop.screenshot_meta", "desk_forge_console");
    assert.equal(result.ok, false);
    assert.equal(result.error, "unsupported_no_verified_adapter");
  });
});
