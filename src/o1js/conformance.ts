import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Cache, Field, verify } from "o1js";
import { BoundSquare, PROGRAM_NAME } from "./program.js";

export interface ConformanceReport {
  schemaVersion: 1;
  o1jsVersion: string;
  program: string;
  verificationKeyHash: string;
  proofDigest: string;
  positive: {
    publicInput: string;
    publicOutput: string;
    verified: boolean;
    roundTripVerified: boolean;
  };
  negative: {
    publicInput: string;
    witness: string;
    rejected: boolean;
    artifactEmitted: boolean;
  };
}

export async function runO1jsConformance(): Promise<ConformanceReport> {
  const manifestPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const packageJson = JSON.parse(await readFile(manifestPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const o1jsVersion = packageJson.dependencies?.o1js;
  if (o1jsVersion !== "2.15.0") {
    throw new Error(`Expected exact o1js version 2.15.0, received '${o1jsVersion ?? "missing"}'.`);
  }

  const { verificationKey } = await BoundSquare.compile({ cache: Cache.None });
  const { proof } = await BoundSquare.proveSquare(Field(25), Field(5));
  const proofJson = proof.toJSON();
  const verified = await verify(proofJson, verificationKey);
  const restoredProof = await BoundSquare.Proof.fromJSON(proofJson);
  const roundTripVerified = await verify(restoredProof.toJSON(), verificationKey);

  let rejected = false;
  let artifactEmitted = false;
  try {
    const invalidResult = await BoundSquare.proveSquare(Field(26), Field(5));
    artifactEmitted = invalidResult.proof !== undefined;
  } catch {
    rejected = true;
  }

  if (!verified || !roundTripVerified || !rejected || artifactEmitted) {
    throw new Error("o1js conformance failed its positive or negative acceptance criteria.");
  }

  return {
    schemaVersion: 1,
    o1jsVersion,
    program: PROGRAM_NAME,
    verificationKeyHash: verificationKey.hash.toString(),
    proofDigest: createHash("sha256").update(JSON.stringify(proofJson)).digest("hex"),
    positive: {
      publicInput: proof.publicInput.toString(),
      publicOutput: proof.publicOutput.toString(),
      verified,
      roundTripVerified,
    },
    negative: {
      publicInput: "26",
      witness: "5",
      rejected,
      artifactEmitted,
    },
  };
}
