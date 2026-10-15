# ECHO Desktop Control Deck

`echo-desktop-ops` is the supported ECHO integration layer for Codex in the ChatGPT desktop app. Version 2 provides a self-contained MCP App control deck plus headless, read-only tools and workflow skills. It does not patch or replace the signed OpenAI desktop package.

## What the control deck measures

- Local RAM total, free, used, utilization, and plugin-process memory.
- QUENCH NVIDIA GPU name, utilization, temperature, and VRAM through a fixed `nvidia-smi` invocation.
- FORGE, ANVIL, TEMPER, HAMMER, and CRUCIBLE through the installed governed ECHO Live Ops collector.
- OpenClaw Gateway health through a fixed, bounded, redacted CLI probe.
- Codex MCP registration and authorization state for ECHO SDK, ECF, Swarm, GitHub, Continuity Fabric, and related ECHO services.
- Native Codex model catalog presence for Astra and SOL 6.1.
- GitHub-first and exact-SHA CertForge release policy.

Every source reports `ok`, `degraded`, `down`, `blocked`, or `unknown`. An unavailable probe stays unknown or blocked; the plugin never substitutes fixtures or synthetic green lights.

## Desktop surface

The `echo_desktop_snapshot` tool opens an MCP App that supports inline, fullscreen, and picture-in-picture display. Its upper rail shows live state lights, with detailed RAM, GPU, fleet, service, governance, model, and Swarm cards below.

The supported plugin API does not provide a permanent app-wide top-border injection point. This package therefore keeps the rail inside the MCP App and leaves signed files under `C:\Program Files\WindowsApps` untouched.

## Tools

- `echo_desktop_get_contract` — state meanings and trust boundaries.
- `echo_desktop_snapshot` — measured snapshot and embedded control deck.
- `echo_openclaw_readonly` — `health`, `models`, or `config_validate` with fixed arguments, timeouts, output limits, and allowlisted results.
- `echo_native_model_catalog` — native Codex `model/list` catalog.
- `echo_requested_model_matrix` — exact-match inventory for Astra, SOL 6.1, Qwen 3.8 27B, requested Claude variants, Fable 5.1, and Grok 4.7.
- `echo_swarm_readiness` — registration and authorization state without starting provider calls.

The old `desktop_action` HTTP compatibility endpoint remains present but rejects the former fake focus, notify, window-list, and screenshot-meta actions with `unsupported_no_verified_adapter`.

## Model boundary

Only models returned by native Codex `model/list` belong in the OpenAI selector. External models remain clearly labeled supervised OpenClaw or ECHO Swarm routes. A catalog match never counts as a successful inference.

## OpenClaw boundary

The adapter accepts no caller-supplied command, executable path, URL, environment-variable name, agent ID, provider credential, or model identifier. Returned health data omits sessions, transcript/database paths, account and bot identifiers, prompts, payloads, raw errors, tokens, cookies, and credential sources.

## Development

```powershell
npm ci
npm run typecheck
npm test
npm run build
node dist/stdio.js
```

The optional legacy loopback HTTP server is started with `npm run start:http` and binds to `127.0.0.1:8788` by default.

## Packaging and release

The canonical portable manifests are `plugin.json` and `mcp.json`; the `.codex-plugin/plugin.json` and `.mcp.json` files remain as compatibility fallbacks. The portable stdio entry uses `${PLUGIN_ROOT}`. A release artifact must include `dist`, runtime dependencies, skills, both manifest formats, license, and documentation.

Source build success is not installation authority. Every candidate must remain on an `agent/*` branch in this GitHub repository, use a draft pull request, pass hosted CI, pass release-stage ECHO preflight, and receive exact-SHA Certification Forge and GitHub App approval before installation. Preserve the previous installed version as the rollback target.
