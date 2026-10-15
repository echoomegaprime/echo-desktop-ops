import { randomUUID } from "node:crypto";
import { redactForLog } from "./redaction.js";

export function requestId(): string {
  return `req_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function diagnostic(event: string, fields: Record<string, unknown> = {}): void {
  const line = redactForLog({
    at: new Date().toISOString(),
    level: "debug",
    event,
    ...fields,
  });
  process.stderr.write(`${JSON.stringify(line)}\n`);
}
