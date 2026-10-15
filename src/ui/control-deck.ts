export const CONTROL_DECK_URI = "ui://echo-desktop-ops/control-deck.html";

export const CONTROL_DECK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ECHO Desktop Control Deck</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: var(--color-background-primary, #071018);
      --panel: var(--color-background-secondary, #0d1823);
      --text: var(--color-text-primary, #eef7ff);
      --muted: var(--color-text-secondary, #93a8ba);
      --line: rgba(148, 163, 184, .20);
      --ok: #22c55e;
      --degraded: #f59e0b;
      --down: #ef4444;
      --blocked: #e879f9;
      --unknown: #64748b;
      --accent: #06b6d4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at top right, rgba(6,182,212,.12), transparent 35%), var(--bg); color: var(--text); }
    main { min-height: 320px; border-top: 4px solid var(--accent); }
    .rail { display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px; background: rgba(2,8,15,.82); border-bottom: 1px solid var(--line); scrollbar-width: thin; }
    .light { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; font-size: 11px; color: var(--muted); }
    .dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--unknown); box-shadow: 0 0 9px color-mix(in srgb, var(--unknown) 70%, transparent); }
    [data-state="ok"] .dot, .dot[data-state="ok"] { background: var(--ok); }
    [data-state="degraded"] .dot, .dot[data-state="degraded"] { background: var(--degraded); }
    [data-state="down"] .dot, .dot[data-state="down"] { background: var(--down); }
    [data-state="blocked"] .dot, .dot[data-state="blocked"] { background: var(--blocked); }
    [data-state="unknown"] .dot, .dot[data-state="unknown"] { background: var(--unknown); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; }
    h1 { font-size: 18px; margin: 0; letter-spacing: .02em; }
    .subtitle { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .actions { display: flex; align-items: center; gap: 8px; }
    button { appearance: none; border: 1px solid rgba(6,182,212,.45); border-radius: 9px; padding: 8px 11px; color: var(--text); background: rgba(6,182,212,.12); cursor: pointer; font: inherit; font-size: 12px; }
    button:disabled { opacity: .55; cursor: wait; }
    .identity { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 12px; }
    .identity-swatch { width: 11px; height: 11px; border-radius: 3px; background: #8b5cf6; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding: 0 16px 16px; }
    section { min-width: 0; padding: 13px; border: 1px solid var(--line); border-radius: 12px; background: linear-gradient(150deg, rgba(255,255,255,.035), transparent), var(--panel); }
    section h2 { margin: 0 0 10px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .metric { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 8px 0; }
    .metric strong { font-size: 19px; }
    .metric span, .row small { color: var(--muted); font-size: 11px; }
    .bar { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(148,163,184,.15); }
    .bar > i { display: block; width: 0; height: 100%; background: linear-gradient(90deg, var(--accent), #8b5cf6); }
    .rows { display: grid; gap: 7px; }
    .row { display: grid; grid-template-columns: 10px minmax(72px, auto) 1fr; gap: 7px; align-items: center; min-width: 0; }
    .row .detail { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; text-align: right; }
    .empty { color: var(--muted); font-size: 12px; }
    footer { padding: 0 16px 14px; color: var(--muted); font-size: 10px; }
    @media (max-width: 520px) { header { align-items: flex-start; flex-direction: column; } .actions { width: 100%; justify-content: space-between; } }
  </style>
</head>
<body>
<main>
  <div id="rail" class="rail" aria-label="Live status rail">
    <span class="light" data-state="unknown"><i class="dot"></i>ECHO SDK</span>
    <span class="light" data-state="unknown"><i class="dot"></i>Vault</span>
    <span class="light" data-state="unknown"><i class="dot"></i>GS343</span>
    <span class="light" data-state="unknown"><i class="dot"></i>FORGE</span>
    <span class="light" data-state="unknown"><i class="dot"></i>ANVIL</span>
    <span class="light" data-state="unknown"><i class="dot"></i>TEMPER</span>
    <span class="light" data-state="unknown"><i class="dot"></i>HAMMER</span>
    <span class="light" data-state="unknown"><i class="dot"></i>CRUCIBLE</span>
    <span class="light" data-state="unknown"><i class="dot"></i>OpenClaw</span>
    <span class="light" data-state="unknown"><i class="dot"></i>CertForge</span>
    <span class="light" data-state="unknown"><i class="dot"></i>GitHub</span>
    <span class="light" data-state="unknown"><i class="dot"></i>Swarm</span>
  </div>
  <header>
    <div><h1>ECHO Desktop Control Deck</h1><div id="subtitle" class="subtitle">Waiting for a measured snapshot…</div></div>
    <div class="actions"><span class="identity"><i id="identity-swatch" class="identity-swatch"></i><span id="identity-label">Local operator</span></span><button id="refresh" type="button">Refresh</button></div>
  </header>
  <div class="grid">
    <section>
      <h2>RAM</h2>
      <div class="metric"><strong id="ram-used">—</strong><span id="ram-total">total —</span></div>
      <div class="bar"><i id="ram-bar"></i></div>
      <div class="metric"><span>Codex plugin process</span><span id="process-ram">—</span></div>
    </section>
    <section>
      <h2>QUENCH GPU</h2>
      <div id="gpu-rows" class="rows"><div class="empty">No measurement yet</div></div>
    </section>
    <section>
      <h2>Fleet nodes</h2>
      <div id="fleet-rows" class="rows"><div class="empty">FORGE · ANVIL · TEMPER · HAMMER · CRUCIBLE</div></div>
    </section>
    <section>
      <h2>Main services</h2>
      <div id="service-rows" class="rows"><div class="empty">ECHO SDK · ECF · Vault · OpenClaw · GS343</div></div>
    </section>
    <section>
      <h2>Build governance</h2>
      <div id="governance-rows" class="rows"><div class="empty">GitHub · CertForge · exact SHA</div></div>
    </section>
    <section>
      <h2>Models and Swarm</h2>
      <div id="model-rows" class="rows"><div class="row"><i class="dot" data-state="unknown"></i><b>Native</b><span class="detail">Astra · SOL 6.1</span></div><div class="row"><i class="dot" data-state="unknown"></i><b>External</b><span class="detail">Qwen · Claude · Grok · Fable</span></div><div class="row"><i class="dot" data-state="unknown"></i><b>Swarm</b><span class="detail">requires admitted provider routes</span></div></div>
    </section>
  </div>
  <footer id="truth">Green means measured healthy. Gray means unknown, not down. This panel uses a supported MCP App surface; the signed desktop package is untouched.</footer>
</main>
<script type="module">
  const byId = (id) => document.getElementById(id);
  const formatBytes = (value) => {
    if (!Number.isFinite(value)) return "—";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let size = value; let index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return size.toFixed(index >= 3 ? 1 : 0) + " " + units[index];
  };
  const stateOf = (value) => ["ok", "degraded", "down", "blocked", "unknown"].includes(value) ? value : "unknown";
  const makeRow = (label, state, detail) => {
    const row = document.createElement("div"); row.className = "row";
    const dot = document.createElement("i"); dot.className = "dot"; dot.dataset.state = stateOf(state);
    const name = document.createElement("b"); name.textContent = String(label || "Unknown");
    const text = document.createElement("span"); text.className = "detail"; text.textContent = String(detail || state || "unknown");
    row.append(dot, name, text); return row;
  };
  const setRows = (element, rows) => { element.replaceChildren(...rows); };
  const render = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const lights = Array.isArray(snapshot.lights) ? snapshot.lights : [];
    const railRows = lights.map((light) => {
      const item = document.createElement("span"); item.className = "light"; item.dataset.state = stateOf(light.state); item.title = String(light.summary || light.reason || light.state || "unknown");
      const dot = document.createElement("i"); dot.className = "dot"; const label = document.createTextNode(String(light.label || light.id || "source")); item.append(dot, label); return item;
    });
    if (railRows.length) setRows(byId("rail"), railRows);
    byId("subtitle").textContent = String(snapshot.overall || "unknown").toUpperCase() + " · " + String(snapshot.collected_at || "time unavailable");
    const user = snapshot.user || {}; byId("identity-label").textContent = String(user.label || "Local operator"); byId("identity-swatch").style.background = /^#[0-9a-f]{6}$/i.test(user.color || "") ? user.color : "#8b5cf6";
    const memory = snapshot.local && snapshot.local.memory ? snapshot.local.memory : {};
    byId("ram-used").textContent = Number.isFinite(memory.used_percent) ? memory.used_percent.toFixed(1) + "%" : "—";
    byId("ram-total").textContent = "total " + formatBytes(memory.total_bytes);
    byId("ram-bar").style.width = Math.max(0, Math.min(100, Number(memory.used_percent) || 0)) + "%";
    byId("process-ram").textContent = formatBytes(memory.process_rss_bytes);
    const gpus = snapshot.gpu && Array.isArray(snapshot.gpu.gpus) ? snapshot.gpu.gpus : [];
    setRows(byId("gpu-rows"), gpus.length ? gpus.map((gpu) => makeRow(gpu.name || ("GPU " + gpu.index), snapshot.gpu.state, String(gpu.utilization_percent ?? "—") + "% · " + String(gpu.memory_used_mib ?? "—") + "/" + String(gpu.memory_total_mib ?? "—") + " MiB")) : [makeRow("QUENCH GPU", snapshot.gpu?.state, snapshot.gpu?.reason || "No trustworthy GPU measurement")]);
    const nodes = snapshot.fleet && Array.isArray(snapshot.fleet.nodes) ? snapshot.fleet.nodes : [];
    setRows(byId("fleet-rows"), nodes.map((node) => makeRow(node.name, node.state, node.reason || (String(node.gpu_count ?? 0) + " GPU · " + String(node.disk_count ?? 0) + " disks"))));
    const service = lights.filter((light) => light.group === "service");
    setRows(byId("service-rows"), service.map((light) => makeRow(light.label, light.state, light.summary || light.reason)));
    const governance = lights.filter((light) => light.group === "governance");
    setRows(byId("governance-rows"), governance.map((light) => makeRow(light.label, light.state, light.summary || light.reason)));
    const matrix = Array.isArray(snapshot.model_matrix) ? snapshot.model_matrix : [];
    const swarm = lights.find((light) => light.id === "echo-swarm");
    const modelRows = matrix.map((item) => makeRow(item.requested, item.catalog_state === "matched" ? "ok" : "unknown", item.catalog_state === "matched" ? "catalog match · inference unverified" : "no measured exact match"));
    if (swarm) modelRows.push(makeRow("Swarm", swarm.state, swarm.summary || swarm.reason));
    if (modelRows.length) setRows(byId("model-rows"), modelRows);
    if (snapshot.truth_policy) byId("truth").textContent = String(snapshot.truth_policy) + " The signed desktop package is untouched.";
  };
  const updateFromResponse = (response) => render(response?.structuredContent?.snapshot || response?.structuredContent || response?.snapshot || response);
  let rpcId = 0; const pending = new Map();
  const rpcNotify = (method, params) => window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
  const rpcRequest = (method, params) => new Promise((resolve, reject) => { const id = ++rpcId; pending.set(id, { resolve, reject }); window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*"); });
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return; const message = event.data; if (!message || message.jsonrpc !== "2.0") return;
    if (typeof message.id === "number") { const request = pending.get(message.id); if (!request) return; pending.delete(message.id); if (message.error) request.reject(message.error); else request.resolve(message.result); return; }
    if (message.method === "ui/notifications/tool-result") updateFromResponse(message.params);
  }, { passive: true });
  const bridgeReady = rpcRequest("ui/initialize", { appInfo: { name: "echo-desktop-control-deck", version: "2.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" }).then((result) => { rpcNotify("ui/notifications/initialized", {}); return result; });
  byId("refresh").addEventListener("click", async () => { const button = byId("refresh"); button.disabled = true; button.textContent = "Refreshing…"; try { await bridgeReady; updateFromResponse(await rpcRequest("tools/call", { name: "echo_desktop_snapshot", arguments: { refresh: true } })); } catch { byId("subtitle").textContent = "Refresh failed · prior measured state retained"; } finally { button.disabled = false; button.textContent = "Refresh"; } });
  if (window.openai?.toolOutput) render(window.openai.toolOutput.snapshot || window.openai.toolOutput);
</script>
</body>
</html>`;
