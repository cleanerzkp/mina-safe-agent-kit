import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("profile CLI", () => {
  test("generates and accepts only the canonical installation-specific profile", async () => {
    const generated = await runCli(["profile", "generate", "--json"]);
    expect(generated.exitCode).toBe(0);
    const profile = JSON.parse(generated.stdout);
    const server = profile.mcpServers.minaSafe;
    expect(server.command).toMatch(/^\//);
    expect(server.args).toEqual([
      "-i",
      expect.stringMatching(/^\//),
      expect.stringMatching(/\/dist\/mcp\/launch-readonly\.js$/),
    ]);

    await withProfile(profile, async (profilePath) => {
      const result = await runCli(["profile", "check", profilePath, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        safe: true,
        command: server.command,
        args: server.args,
        diagnostics: [],
      });
    });
  });

  test("rejects direct HTTP, wallet, mainnet, and environment configuration", async () => {
    const result = await runCli(["profile", "check", "fixtures/profiles/unsafe.json", "--json"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      safe: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ ruleId: "MINA-MCP-PROFILE-001" }),
        expect.objectContaining({ ruleId: "MINA-MCP-PROFILE-002" }),
      ]),
    });
  });

  test("rejects an unsafe sibling server beside the safe launcher", async () => {
    const result = await runCli([
      "profile",
      "check",
      "fixtures/profiles/unsafe-sibling.json",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      safe: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ ruleId: "MINA-MCP-PROFILE-002" }),
      ]),
    });
  });

  test("rejects a PATH-resolved launcher even when its name looks correct", async () => {
    await withProfile(
      { mcpServers: { minaSafe: { command: "mina-safe-mcp", args: [] } } },
      async (profilePath) => {
        const result = await runCli(["profile", "check", profilePath, "--json"]);
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
          expect.objectContaining({
            ruleId: "MINA-MCP-PROFILE-001",
            message: expect.stringContaining("canonical installation-specific launcher"),
          }),
        );
      },
    );
  });

  test("the generated boundary clears Node preloads before the launcher starts", async () => {
    const generated = await runCli(["profile", "generate", "--json"]);
    const server = JSON.parse(generated.stdout).mcpServers.minaSafe as {
      command: string;
      args: string[];
    };

    const result = await runExecutable(server.command, [...server.args, "unexpected"], {
      NODE_OPTIONS: '--import=data:text/javascript,process.stderr.write("PRELOAD_SENTINEL\\n")',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("accepts no arguments");
    expect(result.stderr).not.toContain("PRELOAD_SENTINEL");
  });

  test("the launcher fails before spawn when a wallet variable is ambient", async () => {
    const result = await runModule("src/mcp/launch-readonly.ts", [], {
      MINA_MCP_WALLETS: "/tmp/fake-wallets.json",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Refusing ambient Mina MCP configuration: MINA_MCP_WALLETS");
  });

  test("the launcher rejects mixed-case Mina variables before argument handling", async () => {
    const result = await runModule("src/mcp/launch-readonly.ts", ["unexpected"], {
      mina_mcp_wallets: "/tmp/fake-wallets.json",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Refusing ambient Mina MCP configuration: mina_mcp_wallets");
  });

  test("the child environment keeps operational locale data but drops unrelated secrets", async () => {
    const script = [
      'import { safeChildEnvironment } from "./src/mcp/launch-readonly.ts";',
      "process.stdout.write(JSON.stringify(safeChildEnvironment({",
      '  LANG: "en_US.UTF-8", TMPDIR: "/tmp/safe", GH_TOKEN: "SYNTHETIC_NOT_A_SECRET",',
      '  AWS_SECRET_ACCESS_KEY: "SYNTHETIC_NOT_A_SECRET",',
      '  OPENAI_API_KEY: "SYNTHETIC_NOT_A_SECRET", HOME: "/private/home",',
      '  HTTPS_PROXY: "http://user:pass@example.invalid", BASH_ENV: "/tmp/inject",',
      "})));",
    ].join("\n");
    const result = await execFileAsync(process.execPath, ["--import", "tsx", "--eval", script], {
      cwd: process.cwd(),
    });

    expect(JSON.parse(result.stdout)).toEqual({ LANG: "en_US.UTF-8", TMPDIR: "/tmp/safe" });
  });
});

async function runCli(args: string[]) {
  return runModule("src/cli.ts", args);
}

async function runModule(
  modulePath: string,
  args: string[],
  extraEnv: Record<string, string> = {},
) {
  try {
    const result = await execFileAsync(process.execPath, ["--import", "tsx", modulePath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

async function runExecutable(
  executablePath: string,
  args: string[],
  extraEnv: Record<string, string>,
) {
  try {
    const result = await execFileAsync(executablePath, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

async function withProfile(value: unknown, callback: (path: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mina-safe-profile-"));
  const path = join(directory, "profile.json");
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await callback(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
