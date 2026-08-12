# Contributing

1. Open an issue describing the observable behavior and evidence boundary.
2. Add a failing test at one of the public seams in `CONTEXT.md`.
3. Implement the smallest compatible change.
4. Run `npm run check`.
5. Update source locks and documentation when a supported version changes.

Do not add wallet, signing, write-enabled MCP, remote HTTP, deployment, or secret-handling features.
Disclose material AI assistance in a pull request and state which commands actually ran.
