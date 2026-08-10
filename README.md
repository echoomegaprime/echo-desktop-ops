# echo-desktop-ops

Governed desktop ops MCP — focus, notify, screenshot meta for ECHO fleet consoles. No raw shell, no pixel dumps to models.

**This is a complete connector package**, not a placeholder. It ships a working MCP HTTP server, durable state, governed mutates (`confirm=EXECUTE`), tests, and CI.

## MCP resource
- Path: `/oauth-mcp-desktop-ops-v1`
- Production edge (when routed): `https://mcp.echo-op.com/oauth-mcp-desktop-ops-v1`

## Tools
See `src/tools.ts` — every tool is implemented.

## Run
```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
# MCP: http://127.0.0.1:8788/mcp
# Health: http://127.0.0.1:8788/health
```

## Governed mutates
Any write/control tool requires:
```json
{ "confirm": "EXECUTE" }
```
without that field the tool returns `confirm_required`.

## Data
Runtime state is written under `./data/` (gitignored): proposals, jobs, audit log.

## Identity
Commits: ECHO OMEGA PRIME <bobbymcwilliams@echo-op.com>

Targets: FORGE, ANVIL, HAMMER, TEMPER consoles.

