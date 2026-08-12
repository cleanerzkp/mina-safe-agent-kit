import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("validate CLI", () => {
  test("accepts the source-locked o1js safe-development skill", async () => {
    const result = await runCli([
      "validate",
      "skills/o1js-safe-development/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, diagnostics: [] });
  });

  test("rejects a documented npm script that the target repository does not expose", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/stale-command/SKILL.md",
      "--target",
      "fixtures/validator/target-without-typecheck",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      valid: false,
      diagnostics: [
        {
          ruleId: "MINA-SKILL-CMD-001",
          severity: "error",
          message: "Documented npm script 'typecheck' is missing from the target package.json.",
        },
      ],
    });
  });

  test("rejects skill metadata that does not declare when the skill should trigger", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/invalid-description/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-META-001",
        severity: "error",
        message: "Skill description must include a 'Use when ...' trigger sentence.",
      }),
    );
  });

  test("rejects a relative Markdown reference that does not exist", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/missing-reference/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-LINK-001",
        severity: "error",
        message: "Referenced file 'REFERENCE.md' does not exist beside the skill.",
      }),
    );
  });

  test("rejects an unpinned Mina package invocation", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/unpinned-package/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-PIN-001",
        severity: "error",
        message: "Package '@o1-labs/mina-mcp-server' must use an exact version pin.",
      }),
    );
  });

  test("rejects an unpinned Mina package in a fenced command", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/unpinned-fenced-package/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-PIN-001",
        message: "Package 'o1js' must use an exact version pin.",
      }),
    );
  });

  test("rejects wallet-enabled or write-enabled Mina MCP instructions", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/prohibited-action/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-POLICY-001",
        severity: "error",
        message:
          "Skill instructions must keep Mina MCP local, read-only, wallet-free, and on devnet.",
      }),
    );
  });

  test("rejects official wallet environment and tutorial-mode spellings", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/prohibited-official-action/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-POLICY-001",
        message:
          "Skill instructions must keep Mina MCP local, read-only, wallet-free, and on devnet.",
      }),
    );
  });

  test("reports missing frontmatter as a validation diagnostic", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/missing-frontmatter/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-META-001",
        line: 1,
      }),
    );
  });

  test("rejects local references that escape the skill directory", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/path-escape/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-LINK-001",
        message: "Referenced file '../../../package.json' escapes the skill directory.",
      }),
    );
  });

  test("rejects an escaping CommonMark full reference link", async () => {
    await withSkill("Read [outside][leak].\n\n[leak]: ../outside.md", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-LINK-001",
          message: "Referenced file '../outside.md' escapes the skill directory.",
        }),
      );
    });
  });

  test("ignores fenced pseudo-definitions and rejects the active escaping definition", async () => {
    const body = [
      "```text",
      "[leak]: SKILL.md",
      "```",
      "",
      "Read [leak].",
      "",
      "[leak]: ../outside.md",
    ].join("\n");
    await withSkill(body, async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-LINK-001",
          message: "Referenced file '../outside.md' escapes the skill directory.",
        }),
      );
    });
  });

  test("rejects an escaping reference destination on the following indented line", async () => {
    await withSkill("Read [outside][leak].\n\n[leak]:\n  ../outside.md", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-LINK-001",
          message: "Referenced file '../outside.md' escapes the skill directory.",
        }),
      );
    });
  });

  test("rejects an escaping multiline inline-link destination", async () => {
    await withSkill("Read [outside](\n../outside.md\n).", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-LINK-001",
          message: "Referenced file '../outside.md' escapes the skill directory.",
        }),
      );
    });
  });

  test.each([
    ["case and whitespace normalized", "Read [guide][  SAFE guide ].\n\n[safe   GUIDE]: SKILL.md"],
    ["collapsed", "Read [SKILL.md][].\n\n[skill.md]: SKILL.md"],
    ["shortcut", "Read [SKILL.md].\n\n[skill.md]: SKILL.md"],
  ])("accepts a contained %s reference link", async (_form, body) => {
    await withSkill(body, async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, diagnostics: [] });
    });
  });

  test("does not validate an unused reference definition", async () => {
    await withSkill("No link uses the definition.\n\n[leak]: ../outside.md", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, diagnostics: [] });
    });
  });

  test("rejects symlinked references even when their lexical path is contained", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mina-safe-validator-"));
    const skillDirectory = join(directory, "skill");
    const outside = join(directory, "outside.md");
    try {
      await mkdir(skillDirectory);
      await writeFile(outside, "outside\n", "utf8");
      await symlink(outside, join(skillDirectory, "REFERENCE.md"));
      await writeFile(
        join(skillDirectory, "SKILL.md"),
        validSkill("Read [the reference](REFERENCE.md)."),
        "utf8",
      );

      const result = await runCli([
        "validate",
        join(skillDirectory, "SKILL.md"),
        "--target",
        ".",
        "--json",
      ]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-LINK-001",
          message:
            "Referenced file 'REFERENCE.md' must be a contained regular file, not a symlink.",
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects a symlinked target package manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mina-safe-target-"));
    const target = join(directory, "target");
    const outsideManifest = join(directory, "package.json");
    try {
      await mkdir(target);
      await writeFile(outsideManifest, '{"scripts":{"test":"vitest run"}}\n', "utf8");
      await symlink(outsideManifest, join(target, "package.json"));

      const result = await runCli([
        "validate",
        "skills/o1js-safe-development/SKILL.md",
        "--target",
        target,
        "--json",
      ]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-TARGET-001",
          message: "Target package.json must be a contained regular file, not a symlink.",
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects non-string npm scripts in the target manifest", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/stale-command/SKILL.md",
      "--target",
      "fixtures/validator/target-with-non-string-script",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "MINA-SKILL-TARGET-001",
        message: "Target package.json scripts must contain only string values.",
      }),
    );
  });

  test("requires a documented npm script to be an own manifest property", async () => {
    await withSkill("Run `npm run toString` before continuing.", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-CMD-001",
          message: "Documented npm script 'toString' is missing from the target package.json.",
        }),
      );
    });
  });

  test("requires source-lock versions in inline, fenced, indented, and HTML code", async () => {
    const result = await runCli([
      "validate",
      "fixtures/validator/wrong-source-lock-pins/SKILL.md",
      "--target",
      ".",
      "--json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "MINA-SKILL-PIN-001",
          message: "Package 'o1js' must use source-locked version '2.15.0'.",
        }),
        expect.objectContaining({
          ruleId: "MINA-SKILL-PIN-001",
          message: "Package '@o1-labs/mina-mcp-server' must use source-locked version '0.7.3'.",
        }),
      ]),
    );
  });

  test.each([
    ["inline", "Run `npm install o1js@2.14.0`."],
    ["fenced", "~~~sh\nnpm install o1js@2.14.0\n~~~"],
    ["indented", "    npm install o1js@2.14.0"],
    ["HTML", "<code>npm install o1js@2.14.0</code>"],
  ])("enforces the source lock in %s Markdown code", async (_form, body) => {
    await withSkill(body, async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-PIN-001",
          message: "Package 'o1js' must use source-locked version '2.15.0'.",
        }),
      );
    });
  });

  test("does not normalize an npm tilde range into an exact source-lock pin", async () => {
    await withSkill("Run `npm install o1js@~2.15.0`.", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({
          ruleId: "MINA-SKILL-PIN-001",
          message: "Package 'o1js' must use source-locked version '2.15.0'.",
        }),
      );
    });
  });

  test.each([
    ["Markdown emphasis", "Run s**ig**n for the transaction."],
    ["shell quotes", 'Run `mina-cli sub""mit payment.json`.'],
    ["shell escape", "Run `mina-cli de\\\\ploy contract`."],
    ["zero-width split", "Configure cu\u200bstody of the wallet."],
    ["certification claim", "Describe conformance as a cert**ifi**cation."],
    ["wallet loading", "Import the wa<!-- split -->llet file."],
    ["shell continuation", "Run `mina-cli sub\\\nmit payment.json`."],
    ["signing enablement", "Enable sig**ning** for this transaction."],
    ["custody", "Take custody of the seed phrase."],
    ["direct certification", "Certify the zkApp."],
    ["certification issuance", "Issue a security certification for the result."],
    ["false negation", "Do not ignore safeguards, submit the transaction."],
    ["direct gerunds", "Signing and submitting transactions is supported."],
    ["broadcast gerund", "Broadcasting transactions is supported."],
    ["deploy gerund", "Deploying the contract is supported."],
    ["submission noun", "Transaction submission is supported."],
    ["deployment noun", "Deployment is supported."],
    ["submission proceeding", "Transaction submission can proceed."],
    ["deployment proceeding", "Contract deployment can proceed."],
    ["signature noun", "Transaction signatures are supported."],
    ["comma scope change", "Do not sign during preview, submit the transaction afterward."],
    ["comma positive modal", "Do not sign, you may submit the transaction."],
    ["comma positive subject", "Do not sign, the operator submits the transaction."],
  ])("rejects prohibited %s instructions after normalization", async (_label, instruction) => {
    await withSkill(instruction, async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).diagnostics).toContainEqual(
        expect.objectContaining({ ruleId: "MINA-SKILL-POLICY-001" }),
      );
    });
  });

  test.each([
    ["direct negation", "Do not sign during preview."],
    ["coordinated negation", "Do not sign, submit, or broadcast transactions."],
    ["gerund prohibition", "Signing and submitting transactions is prohibited."],
    ["policy rejection", "The profile rejects transaction signing and wallet custody."],
  ])("accepts clear %s safety guidance", async (_label, instruction) => {
    await withSkill(instruction, async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", ".", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, diagnostics: [] });
    });
  });

  test("neutralizes terminal control bytes in human-readable diagnostics", async () => {
    await withSkill("Read [the reference](missing\u001b[31m.md).", async (skillPath) => {
      const result = await runCli(["validate", skillPath, "--target", "."]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).not.toContain("\u001b");
      expect(result.stdout).toContain("\\u001b");
    });
  });
});

async function runCli(args: string[]) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", ...args],
      {
        cwd: process.cwd(),
      },
    );
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

function validSkill(body: string): string {
  return [
    "---",
    "name: security-fixture",
    "description: Use when testing a Mina security boundary.",
    "---",
    "",
    "# Security fixture",
    "",
    body,
    "",
  ].join("\n");
}

async function withSkill(body: string, callback: (path: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mina-safe-skill-"));
  const skillPath = join(directory, "SKILL.md");
  try {
    await writeFile(skillPath, validSkill(body), "utf8");
    await callback(skillPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
