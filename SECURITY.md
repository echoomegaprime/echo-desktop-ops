# Security Policy

## Reporting
Email security concerns to bobbymcwilliams@echo-op.com. Do not open public issues for secrets.

## Guarantees
- No raw shell exposure
- No mutating desktop or OpenClaw tools
- No caller-supplied executable paths, URLs, environment names, or model IDs
- Secrets, sessions, account identifiers, paths, prompts, and raw provider payloads are omitted from tool results
- Structured diagnostics are written to stderr with recursive redaction and bounded values
- Subprocesses are headless, allowlisted, time-bounded, and output-bounded
- The signed OpenAI desktop package is never modified

## MCP resource
The desktop-only plugin uses stdio through `.mcp.json`. The optional legacy HTTP compatibility server binds to loopback only.
