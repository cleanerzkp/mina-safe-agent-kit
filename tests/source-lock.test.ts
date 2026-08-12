import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("source lock", () => {
  test("declares only string-valued npm scripts", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));

    expect(manifest.scripts).toBeTypeOf("object");
    expect(Object.values(manifest.scripts).every((value) => typeof value === "string")).toBe(true);
  });

  test("excludes stale declaration artifacts from the package", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    const buildConfig = JSON.parse(await readFile("tsconfig.build.json", "utf8"));

    expect(buildConfig.compilerOptions).toMatchObject({ declaration: false, outDir: "dist" });
    expect(manifest.files).toContain("dist/**/*.js");
    expect(manifest.files).toContain("dist/**/*.js.map");
    expect(manifest.files).not.toContain("dist/");
  });

  test("matches exact stable dependencies and npm integrity data", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
    const sourceLock = JSON.parse(await readFile("sources/source-lock.json", "utf8"));

    for (const packageName of ["o1js", "@o1-labs/mina-mcp-server"]) {
      const expected = sourceLock.packages[packageName];
      const locked = lock.packages[`node_modules/${packageName}`];
      expect(manifest.dependencies[packageName]).toBe(expected.version);
      expect(locked.version).toBe(expected.version);
      expect(locked.integrity).toBe(expected.integrity);
    }
  });

  test("keeps the Mesa release candidate outside the stable dependency graph", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8"));
    const mesaLock = JSON.parse(await readFile("compat/mesa/package-lock.json", "utf8"));
    const sourceLock = JSON.parse(await readFile("sources/source-lock.json", "utf8"));

    expect(manifest.dependencies.o1js).toBe("2.15.0");
    expect(sourceLock.experimental.o1js).toMatchObject({
      version: "3.0.0-mesa.rc2",
      blocking: false,
    });
    expect(mesaLock.packages["node_modules/o1js"]).toMatchObject({
      version: sourceLock.experimental.o1js.version,
      integrity: sourceLock.experimental.o1js.integrity,
    });
  });

  test("preserves the upstream empty Windows-native optional lock entry", async () => {
    const lock = JSON.parse(await readFile("package-lock.json", "utf8"));

    expect(lock.packages["node_modules/@o1js/native/node_modules/@o1js/native-win32-x64"]).toEqual({
      optional: true,
    });
  });

  test("binds canonical evaluation mode to the checked-in corpus digest", async () => {
    const corpus = await readFile("evaluations/tasks.json");
    const sourceLock = JSON.parse(await readFile("sources/source-lock.json", "utf8"));

    expect(sourceLock.evaluation).toEqual({
      mode: "canonical",
      corpusVersion: "2026-08-12",
      corpusSha256: createHash("sha256").update(corpus).digest("hex"),
    });
  });
});
