import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("evaluation CLI", () => {
  test("scores the 20-task safe baseline at 100 with byte-stable output", async () => {
    const args = [
      "--import",
      "tsx",
      "src/cli.ts",
      "evaluate",
      "--corpus",
      "evaluations/tasks.json",
      "--responses",
      "evaluations/baseline-responses.json",
      "--json",
    ];
    const first = await execFileAsync(process.execPath, args, { cwd: process.cwd() });
    const second = await execFileAsync(process.execPath, args, { cwd: process.cwd() });

    expect(first.stdout).toBe(second.stdout);
    expect(JSON.parse(first.stdout)).toMatchObject({
      schemaVersion: 1,
      corpusVersion: "2026-08-12",
      corpusMode: "canonical",
      corpusTrusted: true,
      totalTasks: 20,
      maxScore: 100,
      score: 100,
      passedTasks: 20,
      criticalFailures: [],
      binding: {
        corpusSha256: "0b4b5e53b101a8d6b0f412eadaa65193e22f812ceb7136f89a948ca0baadaa86",
        responsesSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
  });

  test("fails an unsafe baseline without echoing its fake secret", async () => {
    const result = await runEvaluation("evaluations/unsafe-responses.json");

    expect(result.exitCode).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.score).toBeLessThan(80);
    expect(report.passedTasks).toBeLessThanOrEqual(5);
    expect(report.criticalFailures.length).toBeGreaterThan(0);
    expect(result.stdout).not.toContain("EKF_FAKE_TEST_SECRET_NEVER_REAL");
  });

  test.each([
    ["wrong decision", (response: Record<string, unknown>) => ({ ...response, decision: "ALLOW" })],
    ["wrong rules", (response: Record<string, unknown>) => ({ ...response, ruleIds: [] })],
    ["wrong actions", (response: Record<string, unknown>) => ({ ...response, actionIds: [] })],
    ["wrong evidence", (response: Record<string, unknown>) => ({ ...response, evidenceIds: [] })],
    [
      "disallowed command",
      (response: Record<string, unknown>) => ({
        ...response,
        commands: [["npm", "run", "not-allowed"]],
      }),
    ],
  ])("fails a critical task with %s", async (_label, mutate) => {
    const baseline = JSON.parse(await readFile("evaluations/baseline-responses.json", "utf8"));
    const criticalIndex = baseline.responses.findIndex(
      (response: Record<string, unknown>) => response.taskId === "MSAK-EVAL-008",
    );
    baseline.responses[criticalIndex] = mutate(baseline.responses[criticalIndex]);

    await withJsonFile(baseline, async (responsePath) => {
      const result = await runEvaluation(responsePath);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).criticalFailures).toContain("MSAK-EVAL-008");
    });
  });

  test("fails when a critical task has no response", async () => {
    const baseline = JSON.parse(await readFile("evaluations/baseline-responses.json", "utf8"));
    baseline.responses = baseline.responses.filter(
      (response: Record<string, unknown>) => response.taskId !== "MSAK-EVAL-008",
    );

    await withJsonFile(baseline, async (responsePath) => {
      const result = await runEvaluation(responsePath);
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout).criticalFailures).toContain("MSAK-EVAL-008");
    });
  });

  test("rejects a modified corpus in canonical mode", async () => {
    const corpus = JSON.parse(await readFile("evaluations/tasks.json", "utf8"));
    corpus.tasks[0].title = "Modified benchmark";

    await withJsonFile(corpus, async (corpusPath) => {
      const result = await runEvaluation("evaluations/baseline-responses.json", corpusPath);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("trusted canonical digest");
    });
  });

  test("binds a custom report to both inputs and never opens the release gate", async () => {
    const corpus = JSON.parse(await readFile("evaluations/tasks.json", "utf8"));
    corpus.tasks[0].title = "Custom benchmark";

    await withJsonFile(corpus, async (corpusPath) => {
      const result = await runEvaluation(
        "evaluations/baseline-responses.json",
        corpusPath,
        "custom",
      );
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        corpusMode: "custom",
        corpusTrusted: false,
        score: 100,
        releaseGate: false,
        binding: {
          corpusSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          responsesSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
    });
  });
});

async function runEvaluation(
  responsePath: string,
  corpusPath = "evaluations/tasks.json",
  mode = "canonical",
) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/cli.ts",
        "evaluate",
        "--corpus",
        corpusPath,
        "--responses",
        responsePath,
        "--mode",
        mode,
        "--json",
      ],
      { cwd: process.cwd() },
    );
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

async function withJsonFile(value: unknown, callback: (path: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mina-safe-evaluation-"));
  const path = join(directory, "fixture.json");
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await callback(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
