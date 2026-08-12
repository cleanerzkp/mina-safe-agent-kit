# Threat model

## Protected assets

- wallet keys and account authority, which this project must never receive;
- the integrity of proof, validation, and evaluation claims;
- stable dependency and source provenance;
- operator machines and target repositories;
- benchmark prompts and response data.

## Trust boundaries

- Skill Markdown and target repositories are untrusted input.
- Private witnesses, callers, proofs, and serialized proof JSON are untrusted input.
- Environment variables and MCP client configuration are untrusted input.
- Public network responses are untrusted and can be stale or unavailable.
- npm and GitHub are distribution channels, not proof of publisher identity beyond their metadata.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Prompt injection in a Skill | Parse as data; never execute target commands; apply prohibited-action rules | A novel unsafe instruction may evade structural checks |
| Stale or invented npm command | Compare documented scripts with the current target manifest | Does not prove the script itself is safe |
| Dependency drift | Exact manifest and lockfile pins plus integrity/source-lock tests | Upstream compromise before publication is still possible |
| Path traversal in local references | Canonical containment plus `lstat` and regular-file checks reject traversal and symlinks | Hard links remain indistinguishable from ordinary files |
| Wallet-variable injection | Launcher refuses ambient `MINA_MCP_*` variables case-insensitively | Protection applies only when the launcher is used |
| Pre-launch environment injection | Generated absolute profile uses `/usr/bin/env -i` before canonical Node and launcher paths | Direct JavaScript entrypoint and Windows are unsupported |
| Write-enabled MCP tools | Fixed live/devnet/stdio launch with no wallets; direct profiles fail validation | A modified official package could change behavior; locks reduce but do not eliminate this risk |
| Remote HTTP exposure | The supported profile has no URL or HTTP transport | Operators can bypass the profile outside this project |
| Secret leakage | Generated profile clears the ambient environment; child variables use a small allowlist; reports omit raw payloads | Process-level logs outside this project remain out of scope |
| Unconstrained private witness | Positive binding assertion plus a failing mismatch fixture | One fixture cannot find arbitrary underconstraints |
| Tampered proof JSON | Typed restoration and independent verification | Application-specific serialization remains out of scope |
| Unsupported security claims | Normalized skill policy checks and explicit evidence layers | Novel natural-language obfuscation can still require human review |
| Evaluation corpus substitution | Canonical mode checks a compiled corpus digest and binds both input digests into the report | A modified package is outside the published artifact trust boundary |
| CI cache poisoning | Lockfiles, read-only workflow permissions, and no persisted proof cache | Third-party Actions and registry infrastructure remain dependencies |

## Fail-closed rules

The project must stop rather than continue when a wallet variable exists, a profile bypasses the
launcher, a proof fails verification, a constraint mismatch emits a proof, the evaluation schema or
canonical digest is invalid, or any dimension of a critical benchmark task fails.
