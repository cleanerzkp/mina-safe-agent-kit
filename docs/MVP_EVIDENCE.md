# MVP evidence

Observed locally on 12 August 2026 in the initial isolated workspace.

## Environment

- Node: `v24.15.0`
- npm: `11.17.0`
- Stable o1js: `2.15.0`
- Official Mina MCP package: `0.7.3`
- Wallets, keys, RPCs, accounts, deployments, and funds: none

## Observed gates

- Validator behavior: safe skill accepted; inline and reference-style path/symlink escapes, invalid target
  scripts, stale commands, source-lock drift, normalized prohibited-action variants, and
  control-character output cases were rejected.
- o1js conformance: compile, prove, verify, JSON restore, and reverify passed; mismatched witness was
  rejected without a proof artifact.
- MCP policy: the generated canonical profile passed; a bare `PATH` launcher, unsafe sibling server,
  and ambient wallet configuration failed. The profile starts Node with an empty environment, and the
  child environment test excluded unrelated token, cloud, home, proxy, and shell-startup variables.
- Evaluation: the source-locked 20-task synthetic safe control scored 100/100. Every mutated or missing
  critical dimension failed. A modified canonical corpus was rejected, custom mode stayed untrusted,
  both input digests appeared in reports, and the unsafe control's fake secret was absent.
- Dependency audit: npm reported zero known vulnerabilities after installation.
- Experimental compatibility: `o1js@3.0.0-mesa.rc2` compiled and verified the isolated proof.
- Reproducibility: `npm ci --dry-run` accepted the root lockfile with npm 11.17.0.
- Artifact smoke: the hardened tarball installed into an isolated temporary prefix with lifecycle
  scripts disabled. Its compiled CLI validated the packaged Skill and generated an
  installation-specific, empty-environment MCP profile.

Run `npm run check` to reproduce the current repository gate. The final handoff should preserve the
exact command output and commit SHA.

## Not yet evidenced

- genuine prompt-only versus skill-assisted model runs;
- five Mina developer reviews;
- a Mina maintainer or ecosystem pilot;
- public repository adoption;
- devnet or mainnet deployment;
- grant eligibility, contracting, payment asset, IP terms, or approval.

No claim in this document upgrades conformance evidence into an audit or production-safety result.
