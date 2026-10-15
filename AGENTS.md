# ECHO Codex Desktop Ops doorway

These instructions apply to the entire repository.

## Purpose

This repository provides the governed ECHO integration layer for Codex in the ChatGPT desktop app. Extend Codex through supported plugins, skills, MCP servers, hooks, and MCP UI resources. Do not modify, replace, unpack, or patch signed files under `C:\Program Files\WindowsApps`.

## Engineering rules

- Follow the global execution constitution and run the task-specific ECHO preflight before substantive engineering and again at release.
- Work on `agent/*` branches and preserve exact-SHA evidence. Do not push directly to the default branch, merge, publish, deploy, or install an uncertified release.
- Keep every server, probe, and provider adapter headless. Do not steal focus, open windows, or launch interactive authentication without a genuine user-presence boundary.
- Treat model providers, OpenClaw, GitHub, CertForge, Continuity Fabric, Vault, SDK, and fleet nodes as distinct trust and availability boundaries.
- Never accept arbitrary shell commands, executable paths, URLs, model identifiers, or environment-variable names from renderer or remote input. Use explicit allowlists and bounded schemas.
- Never log credentials, tokens, cookies, authorization headers, private prompts, or complete provider responses. Use structured, redacted diagnostics with request IDs and safe error categories.
- A plugin installation, registered MCP server, HTTP response, or process state does not prove the user-facing workflow. Verify initialization, tool discovery, representative calls, negative cases, restart durability, and rollback.
- OpenAI account models may be displayed only from the Codex/OpenAI model catalog. External models belong behind clearly labeled supervised tools or a plugin UI; do not misrepresent them as native OpenAI selector entries.

## Required checks

For any source change, run:

```powershell
npm run typecheck
npm test
npm run build
```

Add regression coverage for every material behavior change. Release work must also verify the packaged plugin manifest, MCP initialization and tool list, invalid-input rejection, structured log redaction, clean install/upgrade behavior, and rollback to the previous installed plugin.

## Delivery

Every candidate must start from this GitHub repository, use a draft pull request, pass hosted CI, and obtain exact-SHA CertForge and Certification Forge GitHub App approval before installation into the personal Codex marketplace. Preserve the prior installed plugin as the rollback target.
