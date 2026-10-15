---
name: echo-control-deck
description: Open or inspect the embedded ECHO Desktop Control Deck for measured RAM, QUENCH GPU, FORGE, ANVIL, TEMPER, HAMMER, CRUCIBLE, OpenClaw, ECHO SDK, ECF, Vault, GS343, GitHub, CertForge, and Swarm state. Use when the user asks about desktop status lights, the live HUD, node health, RAM usage, GPU visibility, Crucible timeouts or auth, Forge availability, or Hammer platform migration state.
---

# ECHO Desktop Control Deck

Use `echo_desktop_snapshot` to open the embedded control deck and obtain a current measurement. Use `refresh=true` when the user asks for a fresh read rather than a recent ten-second cache.

## Truth contract

- `ok` means the named source was measured and returned an expected healthy result.
- `degraded` means the source responded with a measured problem or warning.
- `down` means the source was measured unavailable.
- `blocked` means a required authorization or policy boundary is unsatisfied.
- `unknown` means no trustworthy current measurement exists. Never translate unknown into down or up.

Treat registration, installation, configuration, process liveness, source health, authenticated use, successful model inference, exact-SHA certification, deployment, and user acceptance as separate layers.

The plugin may render an inline, fullscreen, or picture-in-picture MCP App. It cannot add a permanent app-wide top border through the supported public plugin surface. Do not modify the signed Codex/ChatGPT Desktop package to simulate one.

When CRUCIBLE reports `connection_timed_out`, report that exact observed category. Do not call it an authentication failure unless the collector returns `authentication_required` or `authentication_failed`. HAMMER's desired Linux platform is a migration target; platform remains unknown until a dedicated current probe measures it.
