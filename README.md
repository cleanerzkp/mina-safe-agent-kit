# Mina Safe Agent Kit

Mina Safe Agent Kit is an independent, open-source guardrail and conformance MVP for AI-assisted
Mina and o1js development. It checks Agent Skills against real repository commands, proves and
verifies a constrained o1js fixture, scores structured safety decisions, and launches the official
Mina MCP server through a fixed read-only policy.

It is not a wallet, signer, deployment tool, static analyzer, audit, or proof of application security.
It contains no unrelated employer, client, or private project code, data, schemas, or internal designs.

## What the MVP proves

- The validator reports stable rule IDs for invalid skill metadata, unsafe local references, invalid
  target manifests, stale npm scripts, source-lock drift, and prohibited wallet or write instructions.
- `o1js@2.15.0` compiles a bound-square ZkProgram, proves `5 × 5 = 25`, independently verifies the
  proof, restores it from JSON, and verifies it again.
- A witness of `5` for a public claim of `26` fails its constraint and emits no proof artifact.
- The Mina MCP profile generator emits canonical absolute paths, starts from an empty environment,
  and fixes the official server to live devnet over local stdio without wallets.
- A source-locked 20-task evaluation binds reports to both inputs and fails every incomplete critical
  response.

These are narrow, reproducible conformance results. They do not establish production safety,
ecosystem adoption, grant approval, or a security audit.

## Quick start

Requirements: Node.js 24 and npm 11.

```sh
npm ci
npm run check
```

Until the first tagged public release, clone this repository and use it locally. No npm package has
been published. Run `npm run build`, then generate an installation-specific MCP profile:

```sh
node dist/cli.js profile generate --json
```

Copy that JSON directly into the MCP client's configuration. Regenerate it after moving or updating
the installation. Do not replace its absolute paths with a command resolved through `PATH`.

Focused commands:

```sh
npm run conformance
npm run evaluate
npm run profile:check
node --import tsx src/cli.ts validate skills/o1js-safe-development/SKILL.md --target . --json
```

`npm run conformance` uses the local proving backend only. It needs no wallet, account, RPC, or
network. `npm run profile:check` is static and does not start the MCP server.

## Safe MCP use

After `npm run build`, configure an MCP client with the output of `profile generate`. The generated
profile clears the ambient environment before starting the canonical Node executable and policy
launcher. The launcher accepts no user arguments and starts the exact installed
`@o1-labs/mina-mcp-server@0.7.3` package with:

```text
--mode live --network devnet --transport stdio
```

It refuses all ambient `MINA_MCP_*` variables before spawning and passes only locale and temporary
directory variables to the child. Do not work around this boundary. The supported package targets
macOS and Linux; Windows is not claimed.

## Evaluation boundary

The checked-in safe and unsafe response files are synthetic scorer controls. A 100/100 result proves
that the scorer recognizes its gold fixture; it does not prove that an AI model improved. A credible
grant application still needs genuine with-skill and without-skill runs under identical model settings,
five Mina developer reviews, and one maintainer or ecosystem pilot.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Evaluation method](docs/EVALUATION.md)
- [MCP profile](docs/MCP_PROFILE.md)
- [Maintenance policy](docs/MAINTENANCE.md)
- [Observed MVP evidence](docs/MVP_EVIDENCE.md)
- [Provisional $30k grant application](docs/GRANT_APPLICATION.md)
- [Official source inventory](docs/OFFICIAL_SOURCES.md)

## Development provenance

The initial MVP used automated coding assistance. Every claim in the evidence report is bounded to
command output or a pinned primary source. No wallet credentials or private project material were
used.

## License

MIT. See [LICENSE](LICENSE).
