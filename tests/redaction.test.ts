import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactForLog } from "../src/lib/redaction.ts";

describe("structured diagnostic redaction", () => {
  it("removes secret keys and credential-shaped strings recursively", () => {
    const value = redactForLog({
      ok: true,
      token: "secret-token",
      nested: {
        authorization: "Bearer abc.def.ghi",
        apiKey: "sk-example-secret",
        tokenSource: "environment",
        path: "C:\\safe\\diagnostic",
      },
      note: "Authorization: Bearer abc123",
    }) as Record<string, unknown>;

    assert.equal(value.token, "[REDACTED]");
    assert.deepEqual(value.nested, {
      authorization: "[REDACTED]",
      apiKey: "[REDACTED]",
      tokenSource: "[REDACTED]",
      path: "C:\\safe\\diagnostic",
    });
    assert.equal(value.note, "Authorization: [REDACTED]");
  });

  it("bounds deeply nested and oversized data", () => {
    const result = redactForLog({ rows: Array.from({ length: 200 }, (_, i) => i) }) as { rows: unknown[] };
    assert.ok(result.rows.length <= 51);
  });
});
