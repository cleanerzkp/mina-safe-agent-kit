import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { stripUnsafeTextControls } from "./terminal.js";

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  ruleId: string;
  severity: DiagnosticSeverity;
  message: string;
  file: string;
  line: number;
}

export interface ValidationReport {
  valid: boolean;
  skill: string;
  target: string;
  diagnostics: Diagnostic[];
}

interface PackageSourceLock {
  packages: Record<string, { version: string }>;
}

const SOURCE_LOCK_PATH = fileURLToPath(new URL("../sources/source-lock.json", import.meta.url));
const POLICY_PATTERNS = [
  /--wallets(?:=|\s)/i,
  /\bMINA_MCP_(?:WALLETS|ALLOW_MAINNET_WRITES)\s*=/i,
  /--mode(?:=|\s+)(?:tutorial|snapshot|live-write)\b/i,
  /--network(?:=|\s+)mainnet\b/i,
  /--transport(?:=|\s+)http\b/i,
  /\b(?:sign|signs|signed|signing|submit|submits|submitted|submitting|broadcast|broadcasts|broadcasted|broadcasting)\b/i,
  /\bsend\b.{0,24}\b(?:transaction|payment|funds?|tokens?)\b/i,
  /\b(?:deploy|deploys|deployed|deploying)\b/i,
  /\b(?:transaction\s+submission|submission\s+of\s+(?:a\s+)?transactions?|deployments?)\b.{0,30}\b(?:is|are|was|were|remains?|becomes?)\s+(?:supported|allowed|enabled|available|permitted|possible)\b/i,
  /\b(?:support|supports|allow|allows|enable|enables|permit|permits)\b.{0,40}\b(?:transaction\s+submission|submission\s+of\s+(?:a\s+)?transactions?|deployments?)\b/i,
  /\b(?:transaction\s+submission|submission\s+of\s+(?:a\s+)?transactions?|(?:contract\s+)?deployments?|transaction\s+signatures?)\b.{0,30}\b(?:can|may|will|should|must|is|are)\s+(?:be\s+)?(?:proceed|proceeding|supported|allowed|enabled|available|permitted|possible)\b/i,
  /\b(?:custody|custodial|custodian|custodying)\b/i,
  /\b(?:load|import|open|read|accept|provide|configure|enable|use|store|handle)\b.{0,40}\b(?:wallet|private key|mnemonic|seed phrase|custod(?:y|ial))\b/i,
  /\b(?:allow|enable|perform|request|create|generate|use|take)\b.{0,40}\b(?:signing|signature|submission|broadcasting|deployment|custody)\b/i,
  /\bcertif(?:y|ies)\b/i,
  /\b(?:describe|claim|call|label|present|treat|certif(?:y|ies)|produce|issue)\b.{0,60}\b(?:audit(?:ed)?|certification|certified|production safe|formally verified)\b/i,
  /\b(?:conformance|kit|skill|zkapp|contract|project|result)\b.{0,30}\b(?:is|as|was|has been)?\s*.{0,20}\b(?:audit(?:ed)?|certification|certified|production safe|formally verified)\b/i,
];

export async function validateSkill(
  skillPath: string,
  targetPath: string,
): Promise<ValidationReport> {
  const resolvedSkill = resolve(skillPath);
  const resolvedTarget = resolve(targetPath);
  const diagnostics: Diagnostic[] = [];

  const skillRoot = await realpath(dirname(resolvedSkill));
  const safeSkill = await inspectRegularFile(resolvedSkill, skillRoot);
  if (!safeSkill.safe) {
    diagnostics.push({
      ruleId: "MINA-SKILL-LINK-001",
      severity: "error",
      message: "SKILL.md must be a contained regular file, not a symlink.",
      file: resolvedSkill,
      line: 1,
    });
    return report(resolvedSkill, resolvedTarget, diagnostics);
  }

  const source = await readFile(safeSkill.canonicalPath, "utf8");
  const frontmatter = parseFrontmatter(source);

  if (!frontmatter) {
    diagnostics.push({
      ruleId: "MINA-SKILL-META-001",
      severity: "error",
      message: "SKILL.md must start with valid YAML mapping frontmatter.",
      file: resolvedSkill,
      line: 1,
    });
  }

  let scripts: Record<string, string> = {};
  const canonicalTarget = await realpath(resolvedTarget).catch(() => resolvedTarget);
  const targetPackagePath = resolve(canonicalTarget, "package.json");
  const safeTargetManifest = await inspectRegularFile(targetPackagePath, canonicalTarget);
  if (!safeTargetManifest.safe) {
    diagnostics.push({
      ruleId: "MINA-SKILL-TARGET-001",
      severity: "error",
      message: "Target package.json must be a contained regular file, not a symlink.",
      file: targetPackagePath,
      line: 1,
    });
  } else {
    try {
      const targetPackage = JSON.parse(
        await readFile(safeTargetManifest.canonicalPath, "utf8"),
      ) as { scripts?: unknown };
      if (targetPackage.scripts !== undefined && !isStringRecord(targetPackage.scripts)) {
        diagnostics.push({
          ruleId: "MINA-SKILL-TARGET-001",
          severity: "error",
          message: "Target package.json scripts must contain only string values.",
          file: targetPackagePath,
          line: 1,
        });
      } else {
        scripts = targetPackage.scripts ?? {};
      }
    } catch {
      diagnostics.push({
        ruleId: "MINA-SKILL-TARGET-001",
        severity: "error",
        message: "Target package.json must contain valid JSON.",
        file: targetPackagePath,
        line: 1,
      });
    }
  }

  if (
    frontmatter !== null &&
    (typeof frontmatter.description !== "string" ||
      !/(?:^|\s)Use when\s+[^.]+\./.test(frontmatter.description))
  ) {
    diagnostics.push({
      ruleId: "MINA-SKILL-META-001",
      severity: "error",
      message: "Skill description must include a 'Use when ...' trigger sentence.",
      file: resolvedSkill,
      line: 1,
    });
  }

  for (const { reference, index } of relativeMarkdownReferences(source)) {
    const resolvedReference = resolve(skillRoot, reference);
    const relativePath = relative(skillRoot, resolvedReference);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      diagnostics.push({
        ruleId: "MINA-SKILL-LINK-001",
        severity: "error",
        message: `Referenced file '${reference}' escapes the skill directory.`,
        file: resolvedSkill,
        line: lineAt(source, index),
      });
      continue;
    }

    const inspected = await inspectRegularFile(resolvedReference, skillRoot);
    if (!inspected.safe) {
      diagnostics.push({
        ruleId: "MINA-SKILL-LINK-001",
        severity: "error",
        message:
          inspected.reason === "missing"
            ? `Referenced file '${reference}' does not exist beside the skill.`
            : `Referenced file '${reference}' must be a contained regular file, not a symlink.`,
        file: resolvedSkill,
        line: lineAt(source, index),
      });
    }
  }

  const sourceLock = JSON.parse(await readFile(SOURCE_LOCK_PATH, "utf8")) as PackageSourceLock;
  for (const { packageName, requiredVersion, observedVersion, index } of invalidMinaPackagePins(
    source,
    sourceLock,
  )) {
    diagnostics.push({
      ruleId: "MINA-SKILL-PIN-001",
      severity: "error",
      message:
        observedVersion === undefined
          ? `Package '${packageName}' must use an exact version pin.`
          : `Package '${packageName}' must use source-locked version '${requiredVersion}'.`,
      file: resolvedSkill,
      line: lineAt(source, index),
    });
  }

  const policyMatch = prohibitedInstruction(source);
  if (policyMatch) {
    diagnostics.push({
      ruleId: "MINA-SKILL-POLICY-001",
      severity: "error",
      message:
        "Skill instructions must keep Mina MCP local, read-only, wallet-free, and on devnet.",
      file: resolvedSkill,
      line: policyMatch.line,
    });
  }

  if (isStringRecord(scripts)) {
    for (const { script, index } of documentedNpmScripts(source)) {
      if (!Object.hasOwn(scripts, script)) {
        diagnostics.push({
          ruleId: "MINA-SKILL-CMD-001",
          severity: "error",
          message: `Documented npm script '${script}' is missing from the target package.json.`,
          file: resolvedSkill,
          line: lineAt(source, index),
        });
      }
    }
  }

  return report(resolvedSkill, resolvedTarget, diagnostics);
}

function report(skill: string, target: string, diagnostics: Diagnostic[]): ValidationReport {
  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    skill,
    target,
    diagnostics,
  };
}

async function inspectRegularFile(
  path: string,
  canonicalRoot: string,
): Promise<
  | { safe: true; canonicalPath: string }
  | { safe: false; reason: "missing" | "symlink" | "not-file" | "escape" }
> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) return { safe: false, reason: "symlink" };
    if (!metadata.isFile()) return { safe: false, reason: "not-file" };
    const canonicalPath = await realpath(path);
    const relativePath = relative(canonicalRoot, canonicalPath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      return { safe: false, reason: "escape" };
    }
    return { safe: true, canonicalPath };
  } catch {
    return { safe: false, reason: "missing" };
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function documentedNpmScripts(source: string): Array<{ script: string; index: number }> {
  return [...source.matchAll(/\bnpm\s+run\s+([a-zA-Z0-9:_-]+)/g)].map((match) => ({
    script: match[1] as string,
    index: match.index ?? 0,
  }));
}

function relativeMarkdownReferences(source: string): Array<{ reference: string; index: number }> {
  const prose = maskMarkdownCode(source);
  const references: Array<{ reference: string; index: number }> = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];

  for (const match of prose.matchAll(
    /!?\[[^\]\n]*\]\([ \t]*(?:\r?\n[ \t]*)?(?:<([^>\n]*)>|([^\s)]+))(?:[ \t]*(?:\r?\n[ \t]*)?(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?[ \t]*(?:\r?\n[ \t]*)?\)/g,
  )) {
    const reference = (match[1] ?? match[2]) as string;
    if (isLocalReference(reference)) {
      references.push({ reference: localReferencePath(reference), index: match.index ?? 0 });
    }
    occupiedRanges.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }

  const definitions = markdownReferenceDefinitions(prose);
  for (const definition of definitions.values()) {
    occupiedRanges.push({ start: definition.start, end: definition.end });
  }

  for (const match of prose.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const label = normalizeReferenceLabel(match[2] || match[1] || "");
    const definition = definitions.get(label);
    if (definition && isLocalReference(definition.reference)) {
      references.push({
        reference: localReferencePath(definition.reference),
        index: match.index ?? 0,
      });
    }
    occupiedRanges.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }

  for (const match of prose.matchAll(/!?\[([^\]\n]+)\](?!\s*[[(])/g)) {
    const index = match.index ?? 0;
    if (occupiedRanges.some((range) => index >= range.start && index < range.end)) continue;
    const definition = definitions.get(normalizeReferenceLabel(match[1] ?? ""));
    if (definition && isLocalReference(definition.reference)) {
      references.push({ reference: localReferencePath(definition.reference), index });
    }
  }

  return references.filter(
    (reference, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.reference === reference.reference && candidate.index === reference.index,
      ) === index,
  );
}

function markdownReferenceDefinitions(
  source: string,
): Map<string, { reference: string; start: number; end: number }> {
  const definitions = new Map<string, { reference: string; start: number; end: number }>();
  const pattern =
    /^ {0,3}\[([^\]\r\n]+)\]:[ \t]*(?:\r?\n[ \t]{0,3})?(?:<([^>\r\n]*)>|([^ \t\r\n]+))(?:[ \t]+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^\r\n)]*\)))?[ \t]*\r?$/gm;
  for (const match of source.matchAll(pattern)) {
    const label = normalizeReferenceLabel(match[1] ?? "");
    const reference = (match[2] ?? match[3]) as string;
    if (!label || definitions.has(label)) continue;
    const start = match.index ?? 0;
    definitions.set(label, { reference, start, end: start + match[0].length });
  }
  return definitions;
}

function normalizeReferenceLabel(label: string): string {
  return label
    .trim()
    .replace(/[ \t\r\n]+/g, " ")
    .toLocaleLowerCase("und");
}

function isLocalReference(reference: string): boolean {
  const trimmed = reference.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith("#") &&
    !trimmed.startsWith("//") &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)
  );
}

function localReferencePath(reference: string): string {
  return reference.trim().split(/[?#]/, 1)[0] as string;
}

function maskMarkdownCode(source: string): string {
  const masked = source.split("");
  const maskRange = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
  };

  let cursor = 0;
  let fence: { character: "`" | "~"; length: number } | undefined;
  while (cursor < source.length) {
    const newline = source.indexOf("\n", cursor);
    const end = newline < 0 ? source.length : newline + 1;
    const line = source.slice(cursor, end).replace(/\r?\n$/, "");

    if (fence) {
      maskRange(cursor, end);
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)?.[1];
      if (closing && closing[0] === fence.character && closing.length >= fence.length) {
        fence = undefined;
      }
    } else {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^\r\n]*)$/)?.[1];
      if (opening) {
        fence = { character: opening[0] as "`" | "~", length: opening.length };
        maskRange(cursor, end);
      } else if (/^(?: {4}|\t)/.test(line)) {
        maskRange(cursor, end);
      }
    }

    cursor = end;
  }

  let prose = masked.join("");
  for (const match of prose.matchAll(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g)) {
    maskRange(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }
  prose = masked.join("");
  for (const match of prose.matchAll(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi)) {
    maskRange(match.index ?? 0, (match.index ?? 0) + match[0].length);
  }
  return masked.join("");
}

function invalidMinaPackagePins(
  source: string,
  sourceLock: PackageSourceLock,
): Array<{
  packageName: string;
  requiredVersion: string;
  observedVersion: string | undefined;
  index: number;
}> {
  const invalid = new Map<
    string,
    { requiredVersion: string; observedVersion: string | undefined; index: number }
  >();

  for (const snippet of codeSnippets(source)) {
    const normalizedSnippet = normalizeInstructionText(snippet.value, false);
    for (const packageName of ["@o1-labs/mina-mcp-server", "o1js"]) {
      const requiredVersion = sourceLock.packages[packageName]?.version;
      if (!requiredVersion) throw new Error(`Source lock is missing package '${packageName}'.`);
      let offset = normalizedSnippet.indexOf(packageName);
      while (offset >= 0) {
        const suffix = normalizedSnippet.slice(offset + packageName.length);
        const version = suffix.match(/^@([^\s'"`<>|;&)]+)/)?.[1];
        if (version !== requiredVersion && !invalid.has(packageName)) {
          invalid.set(packageName, {
            requiredVersion,
            observedVersion: version,
            index: snippet.index + offset,
          });
        }
        offset = normalizedSnippet.indexOf(packageName, offset + packageName.length);
      }
    }
  }

  return [...invalid].map(([packageName, value]) => ({ packageName, ...value }));
}

function codeSnippets(source: string): Array<{ value: string; index: number }> {
  const snippets: Array<{ value: string; index: number }> = [];
  for (const match of source.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)) {
    snippets.push({ value: match[1] as string, index: (match.index ?? 0) + 1 });
  }
  for (const match of source.matchAll(/^ {0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^ {0,3}\1\s*$/gm)) {
    const value = match[2] as string;
    snippets.push({ value, index: (match.index ?? 0) + match[0].indexOf(value) });
  }
  for (const match of source.matchAll(/^(?: {4}|\t)(.*)$/gm)) {
    snippets.push({ value: match[1] as string, index: (match.index ?? 0) + 4 });
  }
  for (const match of source.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)) {
    const value = match[1] as string;
    snippets.push({ value, index: (match.index ?? 0) + match[0].indexOf(value) });
  }
  return snippets.sort((left, right) => left.index - right.index);
}

function prohibitedInstruction(source: string): { line: number } | null {
  const lines = normalizeInstructionText(source.replace(/\\\r?\n/g, "")).split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const normalizedLine = lines[lineIndex] ?? "";
    const clauses = normalizedLine.split(/\s*(?:[.;]|\bbut\b|\bthen\b|\bhowever\b)\s*/i);
    for (const clause of clauses) {
      const plainClause = clause.replace(/^\s*(?:[-+*]|\d+[.)])\s*/, "").trim();
      if (!plainClause || isSafetyClause(plainClause)) continue;
      if (POLICY_PATTERNS.some((pattern) => pattern.test(plainClause))) {
        return { line: lineIndex + 1 };
      }
    }
  }
  return null;
}

function isSafetyClause(clause: string): boolean {
  const negated = clause.match(/^(?:do not|don't|never|must not|shall not)\s+([a-z-]+)/i);
  if (negated?.[1]) {
    const prohibitedVerbs = new Set([
      "accept",
      "allow",
      "broadcast",
      "broadcasting",
      "call",
      "certify",
      "configure",
      "create",
      "deploy",
      "deploying",
      "describe",
      "enable",
      "generate",
      "handle",
      "import",
      "install",
      "issue",
      "label",
      "load",
      "open",
      "perform",
      "present",
      "provide",
      "publish",
      "read",
      "request",
      "send",
      "sign",
      "signing",
      "store",
      "submit",
      "submitting",
      "take",
      "treat",
      "upgrade",
      "use",
    ]);
    if (!prohibitedVerbs.has(negated[1].toLowerCase())) return false;

    const remainder = clause.slice(negated[0].length);
    const fragments = remainder.split(",");
    for (const [index, fragment] of fragments.entries()) {
      if (!POLICY_PATTERNS.some((pattern) => pattern.test(fragment))) continue;
      const normalizedFragment = fragment.trim().replace(/^(?:and|or)\s+/i, "");
      if (isExplicitProhibition(normalizedFragment)) continue;
      if (hasPositiveScopeShift(normalizedFragment)) return false;
      if (index === 0) continue;
      if (
        !/^(?:sign(?:ing)?|submit(?:ting)?|broadcast(?:ing)?|deploy(?:ing)?|send|load|import|open|read|accept|provide|configure|enable|use|store|handle|allow|perform|request|create|generate|take|certify|describe|claim|call|label|present|treat|produce|issue)\b/i.test(
          normalizedFragment,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  if (
    /\b(?:is|are|remain|remains)\s+(?:strictly\s+)?(?:prohibited|forbidden|disabled|unsupported|not supported)\b/i.test(
      clause,
    )
  ) {
    return true;
  }

  if (
    /^(?:(?:the|this|our)\s+)?(?:profile|launcher|validator|skill|kit|tool|policy|project)\s+(?:refuses?|rejects?|prohibits?)\b.{0,80}\b(?:wallet|private key|mnemonic|seed phrase|sign(?:ing)?|submit(?:ting)?|broadcast(?:ing)?|deploy(?:ing|ment)?|custody|certif|audit)/i.test(
      clause,
    )
  ) {
    return true;
  }

  return /^(?:refus(?:e|es|ing)|reject(?:s|ed|ing)?|prohibit(?:s|ed|ing)?)\s+(?:ambient\s+)?(?:--|MINA_MCP_|wallet|private key|mnemonic|seed phrase|sign|submit|broadcast|deploy|custody|certif|audit)/i.test(
    clause,
  );
}

function isExplicitProhibition(clause: string): boolean {
  return (
    /^(?:do not|don't|never|must not|shall not)\b/i.test(clause) ||
    /\b(?:is|are|remain|remains)\s+(?:strictly\s+)?(?:prohibited|forbidden|disabled|unsupported|not supported)\b/i.test(
      clause,
    )
  );
}

function hasPositiveScopeShift(clause: string): boolean {
  return (
    /\b(?:may|can|will|should|afterward|afterwards|later|then|instead|after|before|during|until|once|when|while|outside)\b/i.test(
      clause,
    ) ||
    /\b(?:is|are|was|were|becomes?|remains?)\s+(?:strictly\s+)?(?:supported|allowed|enabled|available|permitted|possible)\b/i.test(
      clause,
    ) ||
    /^(?:(?:the|a|an)\s+)?(?:user|operator|agent|server|tool|wallet|client|developer)\b.{0,30}\b(?:signs?|submits?|broadcasts?|deploys?)\b/i.test(
      clause,
    )
  );
}

function normalizeInstructionText(source: string, stripMarkdownTilde = true): string {
  const normalized = stripUnsafeTextControls(decodeHtmlEntities(source))
    .normalize("NFKC")
    .replace(/\\\r?\n/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/[*_]/g, "")
    .replace(/\\+(?=[A-Za-z0-9_-])/g, "")
    .replace(/['"]/g, "");
  return stripMarkdownTilde ? normalized.replace(/~/g, "") : normalized;
}

function decodeHtmlEntities(source: string): string {
  return source
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_match, encoded: string) => {
      const radix = encoded.toLowerCase().startsWith("x") ? 16 : 10;
      const digits = radix === 16 ? encoded.slice(1) : encoded;
      const codePoint = Number.parseInt(digits, radix);
      return Number.isSafeInteger(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&(commat|period|sol|colon|lowbar);/gi, (match) => {
      const entities: Record<string, string> = {
        commat: "@",
        period: ".",
        sol: "/",
        colon: ":",
        lowbar: "_",
      };
      return entities[match.slice(1, -1).toLowerCase()] ?? match;
    });
}

function parseFrontmatter(source: string): Record<string, unknown> | null {
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match?.[1]) return null;
  try {
    const value: unknown = parseYaml(match[1]);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

export function skillDirectory(skillPath: string): string {
  return dirname(resolve(skillPath));
}
