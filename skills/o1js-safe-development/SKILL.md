---
name: o1js-safe-development
description: Guides evidence-bound Mina and o1js development without wallets or unsupported security claims. Use when building, testing, or reviewing a Mina zkApp, ZkProgram, proof flow, or Mina MCP setup.
---

# o1js Safe Development

## Orient

1. Read the nearest repository instructions and `package.json`.
2. Confirm the installed Node and o1js versions before suggesting commands.
3. Treat caller inputs, private witnesses, serialized proofs, and network responses as untrusted.
4. Read [REFERENCE.md](REFERENCE.md) for supported versions and evidence boundaries.

## Check commands and versions

- Run only scripts declared in the current `package.json`.
- Keep stable o1js pinned to `2.15.0`.
- Keep `3.0.0-mesa.rc2` in a separate, non-blocking experimental lane.
- Do not install, upgrade, deploy, or publish without the user's authorization.

## Build a proof flow

1. Express every security-relevant relationship as a circuit constraint.
2. Bind each private witness to the public statement with an assertion or public result.
3. Keep security logic out of `Provable.asProver()` unless a constraint also enforces it.
4. Bind state reads with `getAndRequireEquals()` or an equivalent precondition.
5. Run `npm run conformance` only when that script exists in the target repository.
6. Compile before proving.
7. Produce a real positive proof and verify it with the matching verification key.
8. Serialize through `toJSON()`, restore through the typed proof class, and verify again.
9. Keep a negative case that fails an intended constraint and emits no proof artifact.

## Use Mina MCP safely

- Use only the installation-specific profile emitted by `profile generate` for read-only devnet use.
- Do not accept wallet files, private keys, `MINA_MCP_*` overrides, HTTP transport, or write tools.
- Do not send secrets to a hosted sandbox or prompt.
- Treat preflight network data as ephemeral. Fail closed when a send gate is unknown.

## Report evidence

- Separate compile, proof, verification, serialization, network, deployment, and adoption evidence.
- State exact versions and commands that actually ran.
- Report failures and unsupported assumptions.
- Never describe conformance as an audit, formal verification, or production-security proof.

## Constraint example

- Safe: witness `root`, then assert `root.mul(root).equals(publicSquare)` in the circuit.
- Unsafe: compare the witness only inside `Provable.asProver()` and treat the runtime result as proof.
