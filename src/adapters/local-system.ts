import { arch, cpus, freemem, hostname, platform, release, totalmem, uptime } from "node:os";

export type LocalSystemSnapshot = {
  state: "ok";
  observed_at: string;
  host: {
    hostname: string;
    platform: string;
    release: string;
    architecture: string;
    logical_cpu_count: number;
    uptime_seconds: number;
  };
  memory: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    used_percent: number;
    process_rss_bytes: number;
    process_heap_used_bytes: number;
  };
};

export function collectLocalSystem(): LocalSystemSnapshot {
  const total = totalmem();
  const free = freemem();
  const used = Math.max(0, total - free);
  const processMemory = process.memoryUsage();
  return {
    state: "ok",
    observed_at: new Date().toISOString(),
    host: {
      hostname: hostname().slice(0, 128),
      platform: platform(),
      release: release().slice(0, 128),
      architecture: arch(),
      logical_cpu_count: cpus().length,
      uptime_seconds: Math.floor(uptime()),
    },
    memory: {
      total_bytes: total,
      used_bytes: used,
      free_bytes: free,
      used_percent: total > 0 ? Math.round((used / total) * 10_000) / 100 : 0,
      process_rss_bytes: processMemory.rss,
      process_heap_used_bytes: processMemory.heapUsed,
    },
  };
}
