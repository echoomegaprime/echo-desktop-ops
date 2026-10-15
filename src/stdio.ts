#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { diagnostic } from "./lib/logger.js";
import { createDesktopOpsServer } from "./server.js";

const server = createDesktopOpsServer();
diagnostic("server.start", { transport: "stdio", version: "2.0.0" });
await server.connect(new StdioServerTransport());
