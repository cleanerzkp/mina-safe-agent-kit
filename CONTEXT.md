# Product seams

The MVP has four public seams:

1. `validate`: inspect an Agent Skill against a target repository and emit stable diagnostics.
2. `conformance`: compile, prove, and verify pinned o1js fixtures without a wallet or network.
3. `evaluate`: score versioned candidate decisions against a deterministic 20-task corpus.
4. `profile check`: reject unsafe Mina MCP profiles before an operator uses them.

Tests observe CLI input, JSON output, and exit status. They do not assert internal calls.
