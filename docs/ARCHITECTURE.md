# Architecture

## Boundaries

```text
SKILL.md + target package.json ──> validator CLI ──> diagnostics report
o1js fixture ───────────────────> conformance CLI ──> proof report
tasks + structured responses ──> evaluation CLI ──> score report
MCP client profile ─────────────> policy launcher ──> official Mina MCP
```

The first three flows are offline. The policy launcher is the only component that may reach a Mina
endpoint, and only when a human configures and starts it outside normal tests.

## Validator

The validator reads Markdown, YAML frontmatter, local references, code snippets, the source lock, and
the target `package.json`. It rejects symlinks and non-regular files at trust boundaries, canonicalizes
paths, and never executes a documented command. Diagnostics use stable Rule IDs so CI and editors can
consume them.

## o1js conformance

`BoundSquare` accepts a public expected square and a private root. Its circuit asserts that the
private root squared equals the public input. The positive path compiles, proves, verifies, serializes,
restores, and reverifies. The negative path supplies a mismatched public input and must fail before a
proof artifact exists.

## Evaluation

The scorer accepts structured decisions only. It compares decisions and exact Rule, action, and
evidence sets, then checks command allowlists and a deterministic oracle. Canonical mode verifies the
trusted corpus digest. Every report includes corpus and response digests. Custom mode never opens the
release gate. It never prints raw prompts, candidate comments, or candidate command arguments.

## Mina MCP policy

The profile generator resolves canonical absolute paths for `/usr/bin/env`, Node, and the compiled
policy launcher. The profile uses `env -i`, so Node does not inherit `PATH`, Node preload settings,
proxy credentials, or unrelated tokens. The launcher verifies the exact installed official package,
starts it with fixed live/devnet/stdio arguments, rejects ambient Mina MCP variables, and gives the
child only a small operational environment allowlist.

## Explicit non-goals

- transaction signing or submission;
- wallet or key management;
- deployment and contract lifecycle management;
- general circuit or smart-contract security analysis;
- remote MCP hosting;
- model training or opaque LLM judging.
