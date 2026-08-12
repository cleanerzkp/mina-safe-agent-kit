import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("conformance CLI", () => {
  test("compiles, proves, serializes, and verifies a bound witness while rejecting a mismatch", async () => {
    const cliPath = resolve("dist/cli.js");
    const unrelatedDirectory = await mkdtemp(join(tmpdir(), "mina-safe-agent-kit-"));
    let report: Record<string, unknown>;
    try {
      const result = await execFileAsync(process.execPath, [cliPath, "conformance", "--json"], {
        cwd: unrelatedDirectory,
        maxBuffer: 10 * 1024 * 1024,
      });
      report = JSON.parse(result.stdout);
    } finally {
      await rm(unrelatedDirectory, { recursive: true, force: true });
    }

    expect(report).toMatchObject({
      schemaVersion: 1,
      o1jsVersion: "2.15.0",
      program: "mina-safe-bound-square-v1",
      positive: {
        publicInput: "25",
        publicOutput: "5",
        verified: true,
        roundTripVerified: true,
      },
      negative: {
        publicInput: "26",
        witness: "5",
        rejected: true,
        artifactEmitted: false,
      },
    });
    expect(report.verificationKeyHash).toMatch(/^\d+$/);
    expect(report.proofDigest).toMatch(/^[a-f0-9]{64}$/);
  }, 600_000);
});
