---
name: openclaw-desktop
description: Inspect the locally installed OpenClaw gateway, model catalog, or configuration validity from Codex Desktop using bounded headless read-only CLI adapters. Use when the user asks to integrate OpenClaw, check its health, see its configured model inventory, or validate its configuration.
---

# OpenClaw in Codex Desktop

Use `echo_openclaw_readonly` with exactly one operation:

- `health` for the Gateway snapshot.
- `models` for published catalog facts only.
- `config_validate` for validation counts.

The adapter invokes only the installed OpenClaw entrypoint with fixed arguments, a fixed timeout, and a bounded output size. It never accepts a shell command, executable path, URL, environment-variable name, agent ID, provider credential, or model ID from the caller.

Never expose or reconstruct raw health output. The safe result intentionally omits session keys, transcript or database paths, account and bot identifiers, prompts, payloads, tokens, credential sources, and raw errors. A top-level OpenClaw `ok: true` proves that the health RPC produced a snapshot; queue failures and unhealthy channels can still make the result degraded.

Catalog presence is not proof that a model call is authorized or succeeds. Do not start a model inference, mutate OpenClaw configuration, restart its Gateway, relink a channel, install a plugin, or recover a queue through this skill.
