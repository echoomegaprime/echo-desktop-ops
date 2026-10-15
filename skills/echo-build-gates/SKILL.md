---
name: echo-build-gates
description: Enforce the user's GitHub-first and exact-SHA CertForge gates for Codex Desktop plugin builds. Use when creating, changing, packaging, certifying, installing, updating, releasing, or rolling back this desktop integration.
---

# ECHO Desktop build gates

Every candidate starts in an identified GitHub repository on an `agent/*` branch. Preserve the base SHA, candidate SHA, remote branch, draft pull request, CI result, and rollback target.

Before installation or release:

1. Run the repository test, typecheck, build, manifest, MCP initialization, tool-discovery, invalid-input, log-redaction, clean-install, upgrade, restart-durability, and rollback checks.
2. Run release-stage ECHO preflight without downgrading failed gates.
3. Obtain Certification Forge and GitHub App approval for the exact candidate SHA.
4. Read back the certificate verdict and exact SHA. A local PASS, open pull request, green CI run, registered plugin, or MCP connection is not certification.
5. Install only the certified artifact and preserve the previous installed version as a rollback target.

Never merge, publish, deploy, install, or modify the signed WindowsApps package merely because the source build passed.
