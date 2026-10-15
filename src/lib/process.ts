import { spawn } from "node:child_process";

export type CommandResult = {
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
  output_limited: boolean;
  spawn_error?: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { timeout_ms?: number; max_output_bytes?: number; cwd?: string },
) => Promise<CommandResult>;

export const runBoundedCommand: CommandRunner = async (command, args, options = {}) => {
  const timeoutMs = Math.max(100, Math.min(options.timeout_ms ?? 8_000, 60_000));
  const maxOutputBytes = Math.max(1_024, Math.min(options.max_output_bytes ?? 262_144, 1_048_576));
  const started = Date.now();

  return await new Promise<CommandResult>((resolve) => {
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let timedOut = false;
    let outputLimited = false;
    let settled = false;
    let spawnError: string | undefined;

    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exit_code: exitCode,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        duration_ms: Date.now() - started,
        timed_out: timedOut,
        output_limited: outputLimited,
        ...(spawnError ? { spawn_error: spawnError } : {}),
      });
    };

    const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> => {
      if (current.length >= maxOutputBytes) return current;
      const remaining = maxOutputBytes - current.length;
      if (chunk.length > remaining) {
        outputLimited = true;
        return Buffer.concat([current, chunk.subarray(0, remaining)]);
      }
      return Buffer.concat([current, chunk]);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
      if (outputLimited) child.kill();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
      if (outputLimited) child.kill();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnError = error.code ?? "spawn_failed";
      finish(null);
    });
    child.on("close", (code) => finish(code));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      setTimeout(() => finish(null), 500).unref();
    }, timeoutMs);
    timer.unref();
  });
};

export function classifyCommandFailure(result: CommandResult): { state: "blocked" | "unknown" | "degraded"; reason: string } {
  if (result.timed_out) return { state: "unknown", reason: "command_timed_out" };
  if (result.output_limited) return { state: "degraded", reason: "output_limit_exceeded" };
  if (result.spawn_error === "ENOENT") return { state: "unknown", reason: "executable_not_found" };
  const lower = result.stderr.toLowerCase();
  if (lower.includes("not logged in") || lower.includes("unauthorized") || lower.includes("permission denied") || lower.includes("authentication")) {
    return { state: "blocked", reason: "authentication_required_or_failed" };
  }
  return { state: "unknown", reason: "command_failed" };
}
