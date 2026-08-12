#!/usr/bin/env node

import { type EvaluationMode, evaluateResponses, formatEvaluationMarkdown } from "./evaluation.js";
import { checkMcpProfile, generateMcpProfile } from "./mcp/profile.js";
import { runO1jsConformance } from "./o1js/conformance.js";
import { terminalSafe } from "./terminal.js";
import { validateSkill } from "./validator.js";

interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  options: Map<string, string | true>;
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.command === "validate") {
    const skillPath = parsed.positional[0];
    const targetPath = parsed.options.get("target");
    if (!skillPath || typeof targetPath !== "string") {
      throw new Error("Usage: mina-safe-agent-kit validate <SKILL.md> --target <repo> [--json]");
    }

    const report = await validateSkill(skillPath, targetPath);
    if (parsed.options.has("json")) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const diagnostic of report.diagnostics) {
        process.stdout.write(
          `${diagnostic.severity} ${diagnostic.ruleId}: ${terminalSafe(diagnostic.message)}\n`,
        );
      }
    }
    return report.valid ? 0 : 1;
  }

  if (parsed.command === "conformance") {
    const report = await runO1jsConformance();
    process.stdout.write(
      parsed.options.has("json")
        ? `${JSON.stringify(report, null, 2)}\n`
        : formatConformance(report),
    );
    return 0;
  }

  if (parsed.command === "profile" && parsed.positional[0] === "check") {
    const profilePath = parsed.positional[1];
    if (!profilePath) {
      throw new Error("Usage: mina-safe-agent-kit profile check <profile.json> [--json]");
    }
    const report = await checkMcpProfile(profilePath);
    if (parsed.options.has("json")) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const diagnostic of report.diagnostics) {
        process.stdout.write(`${diagnostic.ruleId}: ${terminalSafe(diagnostic.message)}\n`);
      }
    }
    return report.safe ? 0 : 1;
  }

  if (parsed.command === "profile" && parsed.positional[0] === "generate") {
    const profile = await generateMcpProfile();
    process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
    return 0;
  }

  if (parsed.command === "evaluate") {
    const corpusPath = parsed.options.get("corpus");
    const responsesPath = parsed.options.get("responses");
    if (typeof corpusPath !== "string" || typeof responsesPath !== "string") {
      throw new Error(
        "Usage: mina-safe-agent-kit evaluate --corpus <tasks.json> --responses <responses.json> [--json|--markdown]",
      );
    }
    const requestedMode = parsed.options.get("mode") ?? "canonical";
    if (requestedMode !== "canonical" && requestedMode !== "custom") {
      throw new Error("Evaluation mode must be 'canonical' or 'custom'.");
    }
    const report = await evaluateResponses(
      corpusPath,
      responsesPath,
      requestedMode as EvaluationMode,
    );
    process.stdout.write(
      parsed.options.has("markdown")
        ? formatEvaluationMarkdown(report)
        : `${JSON.stringify(report, null, 2)}\n`,
    );
    return report.releaseGate ? 0 : 1;
  }

  throw new Error("Usage: mina-safe-agent-kit <validate|conformance|evaluate|profile> ...");
}

function formatConformance(report: Awaited<ReturnType<typeof runO1jsConformance>>): string {
  return [
    `o1js ${report.o1jsVersion} / ${report.program}`,
    `positive proof: ${report.positive.verified && report.positive.roundTripVerified ? "PASS" : "FAIL"}`,
    `negative constraint: ${report.negative.rejected ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const options = new Map<string, string | true>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const name = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(name, next);
      index += 1;
    } else {
      options.set(name, true);
    }
  }

  return { command, positional, options };
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${terminalSafe(message)}\n`);
    process.exitCode = 2;
  });
