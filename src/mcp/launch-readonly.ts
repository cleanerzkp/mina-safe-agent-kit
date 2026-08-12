#!/usr/bin/env node

import { spawn } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { terminalSafe } from "../terminal.js";

const OFFICIAL_PACKAGE = "@o1-labs/mina-mcp-server";
const OFFICIAL_VERSION = "0.7.3";
const FIXED_ARGS = ["--mode", "live", "--network", "devnet", "--transport", "stdio"] as const;
const CHILD_ENV_ALLOWLIST = new Set(["LANG", "TMPDIR", "TMP", "TEMP", "TZ"]);

async function main(): Promise<number> {
  const forbiddenVariables = Object.keys(process.env)
    .filter((name) => name.toUpperCase().startsWith("MINA_MCP_"))
    .sort();
  if (forbiddenVariables.length > 0) {
    throw new Error(`Refusing ambient Mina MCP configuration: ${forbiddenVariables.join(", ")}`);
  }

  if (process.argv.length > 2) {
    throw new Error("The generated Mina MCP launcher accepts no arguments; its policy is fixed.");
  }

  const require = createRequire(import.meta.url);
  const packageManifest = require.resolve(`${OFFICIAL_PACKAGE}/package.json`);
  const manifestMetadata = await lstat(packageManifest);
  if (!manifestMetadata.isFile() || manifestMetadata.isSymbolicLink()) {
    throw new Error("Official Mina MCP package manifest must be a regular file, not a symlink.");
  }
  const packageMetadata = JSON.parse(await readFile(await realpath(packageManifest), "utf8")) as {
    version?: unknown;
  };
  if (packageMetadata.version !== OFFICIAL_VERSION) {
    throw new Error(
      `Official Mina MCP package version must be exactly ${OFFICIAL_VERSION}; received ${String(packageMetadata.version)}.`,
    );
  }

  const unresolvedEntrypoint = require.resolve(OFFICIAL_PACKAGE);
  const entrypointMetadata = await lstat(unresolvedEntrypoint);
  if (!entrypointMetadata.isFile() || entrypointMetadata.isSymbolicLink()) {
    throw new Error("Official Mina MCP entrypoint must be a regular file, not a symlink.");
  }
  const entrypoint = await realpath(unresolvedEntrypoint);
  const child = spawn(process.execPath, [entrypoint, ...FIXED_ARGS], {
    env: safeChildEnvironment(process.env),
    stdio: "inherit",
    shell: false,
  });

  return await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Official Mina MCP server stopped with signal ${signal}.`));
        return;
      }
      resolveExit(code ?? 1);
    });
  });
}

export function safeChildEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(([name]) => {
      const normalizedName = name.toUpperCase();
      return CHILD_ENV_ALLOWLIST.has(normalizedName) || normalizedName.startsWith("LC_");
    }),
  );
}

export const readonlyLaunchPolicy = {
  package: OFFICIAL_PACKAGE,
  version: OFFICIAL_VERSION,
  mode: "live",
  network: "devnet",
  transport: "stdio",
  args: [...FIXED_ARGS],
} as const;

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && pathToFileURL(entrypoint).href === import.meta.url;
}

if (isMainModule()) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${terminalSafe(message)}\n`);
      process.exitCode = 2;
    });
}
