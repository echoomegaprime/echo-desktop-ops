#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const artifacts = resolve(root, "artifacts");
const staging = resolve(artifacts, `${pkg.name.split("/").at(-1)}-${pkg.version}`);
const relation = relative(root, staging);

if (!relation.startsWith(`artifacts${process.platform === "win32" ? "\\" : "/"}`) || relation.includes("..") || staging === root) {
  throw new Error("unsafe_staging_path");
}
if (!existsSync(join(root, "dist", "stdio.js"))) throw new Error("build_missing_run_npm_build");

mkdirSync(artifacts, { recursive: true });
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

const required = [
  "dist",
  "skills",
  ".codex-plugin",
  "plugin.json",
  "mcp.json",
  ".mcp.json",
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CHANGELOG.md",
];

for (const name of required) {
  const source = join(root, name);
  if (!existsSync(source)) throw new Error(`required_package_input_missing:${name}`);
  const destination = join(staging, name);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: statSync(source).isDirectory() });
}

const npmCli = process.platform === "win32" ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js") : null;
if (npmCli && !existsSync(npmCli)) throw new Error("trusted_npm_cli_not_found");
const npmCommand = npmCli ? process.execPath : "npm";
const npmArgs = [...(npmCli ? [npmCli] : []), "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"];
execFileSync(npmCommand, npmArgs, {
  cwd: staging,
  stdio: "inherit",
  windowsHide: true,
});

process.stdout.write(`${staging}\n`);
