---
name: echo-model-routing
description: Check native Codex model availability and supervised external model or Swarm readiness for Astra, SOL 6.1, Qwen 3.8 27B, requested Claude variants, Fable 5.1, and Grok 4.7. Use when the user asks to add, select, compare, or swarm models in Codex or ChatGPT Desktop.
---

# ECHO model routing

Use `echo_native_model_catalog` for native Codex/OpenAI models and `echo_requested_model_matrix` for the user's requested cross-provider inventory.

## Boundaries

- Only models returned by the current Codex `model/list` catalog may be described as present in the native desktop selector.
- A catalog row is availability metadata, not proof of account entitlement or a successful inference.
- External providers belong behind supervised MCP tools, OpenClaw, or ECHO Swarm. Do not present Qwen, Claude, Fable, or Grok as native OpenAI selector entries.
- `echo_swarm_readiness` checks registration and authorization only. It does not convene providers or consume tokens.
- Use the existing ECHO Swarm tools for a real council only after `swarm_ping` succeeds. Identify skipped seats and preserve dissent. Never invent a provider response.

If a requested version string has no exact measured match, leave it `unverified`. Do not silently substitute a nearby model version.
