# Maintenance policy

## Stable lane

- Keep stable o1js exact, not a caret or `latest` range.
- Keep the Mina MCP server exact and verify npm integrity against `sources/source-lock.json`.
- Update one dependency at a time in a dedicated change.
- Rerun static, proof-conformance, profile-policy, and evaluation gates.
- Record breaking behavior and evidence-bound compatibility in `CHANGELOG.md`.

## Experimental lane

Mesa release candidates live under `compat/mesa` with a separate lockfile. The job is non-blocking and
must never replace the stable dependency silently. Preflight networks and RC APIs are ephemeral.

## Rule changes

Rule IDs are public interfaces. Add a new ID for a new invariant. Preserve old IDs unless their
behavior was wrong; document any correction and provide a migration note.

## Source review

Recheck official package versions, npm integrity, licenses, source commits, supported Node versions,
MCP tool modes, and open security limitations before each release. Never infer grant payout, IP, or
contract terms from source-code licenses.
