# Changelog

## 2.0.0 — 2026-10-15
- Made OpenClaw health probing resilient to slow Gateway wake-up and retained specific structured failure reasons.
- Added a redacted configured-route fallback when the published OpenClaw model catalog times out or is not ready.
- Replaced synthetic focus, notification, window, and screenshot success claims with explicit unsupported results.
- Added a supported MCP App control deck with an in-panel status rail and inline, fullscreen, and picture-in-picture modes.
- Added measured RAM and QUENCH NVIDIA GPU telemetry.
- Integrated the existing governed ECHO Live Ops collector for FORGE, ANVIL, TEMPER, HAMMER, and CRUCIBLE.
- Added bounded, headless, allowlisted, and redacted OpenClaw health, model-catalog, and config-validation probes.
- Added native Codex model catalog and exact requested-model matrix tools.
- Added Swarm readiness, GitHub/CertForge policy state, structured redacted diagnostics, and four workflow skills.
- Added the Codex plugin manifest, stdio MCP server, package lock, and official MCP Apps bridge.
- Bound the legacy HTTP server to loopback and limited request bodies to 1 MiB.

## 1.0.0 — 2026-08-10
- Full governed MCP server implementation (not a scaffold)
- Streamable HTTP `/mcp` JSON-RPC tools
- Durable JSON store + audit log
- CI: typecheck, test, build
