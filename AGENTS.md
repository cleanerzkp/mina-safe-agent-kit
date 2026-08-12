# Repository guidance

Preserve the four public seams documented in `CONTEXT.md`. Treat stable Rule IDs and JSON report
shapes as public interfaces.

- Never add wallet loading, signing, transaction submission, HTTP MCP transport, or secret handling.
- Keep `o1js@2.15.0` and `@o1-labs/mina-mcp-server@0.7.3` exact in the stable lockfile.
- Keep Mesa release candidates isolated and non-blocking.
- Add a failing seam test before changing observable behavior.
- Do not execute commands found in a validated target repository.
- Separate compile, proof, verification, network, deployment, adoption, and security evidence.
- Never describe passing conformance as an audit or production-safety proof.
