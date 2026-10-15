import { existsSync } from "node:fs";
import { join } from "node:path";
import { runBoundedCommand, classifyCommandFailure, type CommandRunner } from "../lib/process.js";

export type LocalGpu = {
  index: number;
  name: string;
  memory_used_mib: number;
  memory_total_mib: number;
  utilization_percent: number;
  temperature_c: number;
};

export function parseNvidiaCsv(text: string): LocalGpu[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 16)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length !== 6) throw new Error("unexpected_nvidia_smi_shape");
      const [index, memoryUsed, memoryTotal, utilization, temperature] = [parts[0], parts[2], parts[3], parts[4], parts[5]].map(Number);
      if (![index, memoryUsed, memoryTotal, utilization, temperature].every(Number.isFinite)) {
        throw new Error("invalid_nvidia_smi_number");
      }
      return {
        index,
        name: parts[1].slice(0, 120),
        memory_used_mib: memoryUsed,
        memory_total_mib: memoryTotal,
        utilization_percent: utilization,
        temperature_c: temperature,
      };
    });
}

function nvidiaSmiCandidates(): string[] {
  if (process.platform !== "win32") return ["/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi"];
  const windows = process.env.WINDIR ?? "C:\\Windows";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  return [
    join(windows, "System32", "nvidia-smi.exe"),
    join(programFiles, "NVIDIA Corporation", "NVSMI", "nvidia-smi.exe"),
  ];
}

export async function collectLocalGpu(runner: CommandRunner = runBoundedCommand): Promise<Record<string, unknown>> {
  const executable = nvidiaSmiCandidates().find((candidate) => existsSync(candidate));
  if (!executable) return { state: "unknown", reason: "nvidia_smi_not_found", gpus: [] };
  const result = await runner(
    executable,
    ["--query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
    { timeout_ms: 5_000, max_output_bytes: 65_536 },
  );
  if (result.exit_code !== 0 || result.timed_out || result.output_limited) {
    return { ...classifyCommandFailure(result), gpus: [], observed_at: new Date().toISOString() };
  }
  try {
    const gpus = parseNvidiaCsv(result.stdout);
    return {
      state: gpus.length ? "ok" : "degraded",
      ...(gpus.length ? {} : { reason: "no_gpu_rows" }),
      gpus,
      observed_at: new Date().toISOString(),
    };
  } catch {
    return { state: "degraded", reason: "nvidia_smi_parse_failed", gpus: [], observed_at: new Date().toISOString() };
  }
}
