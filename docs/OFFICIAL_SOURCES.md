# Official source inventory

Checked on 12 August 2026.

- [Mina Builders Grants Program](https://minaprotocol.com/builder-grants-program): rolling Exploration
  `USD 1k–5k`, Builder `USD 5k–30k`, and negotiated Partnership/Investment `USD 100k+` lanes.
- [o1js 2.15.0 source](https://github.com/o1-labs/o1js/tree/a6fe4871dc5bccfc553ce9a08f63c97758b2722c):
  stable circuit and proof dependency.
- [Official compile/prove/verify example](https://github.com/o1-labs/o1js/blob/a6fe4871dc5bccfc553ce9a08f63c97758b2722c/src/examples/zkprogram/program-with-input.ts):
  lifecycle and typed proof JSON restoration.
- [Secure zkApp guidance](https://docs.minaprotocol.com/zkapps/writing-a-zkapp/introduction-to-zkapps/secure-zkapps):
  adversarial inputs, witness constraints, state preconditions, and evidence limits.
- [Mina MCP 0.7.3 README](https://github.com/MinaProtocol/mina-mcp-server/blob/2404419a04743de36637743d1187cfe424586d67/README.md):
  live/read-only mode, devnet, stdio, wallet promotion, and preflight warnings.
- [Mina MCP security policy](https://github.com/MinaProtocol/mina-mcp-server/blob/2404419a04743de36637743d1187cfe424586d67/SECURITY.md):
  beta boundary and key-handling warnings.
- [Mina MCP hardening issue 26](https://github.com/MinaProtocol/mina-mcp-server/issues/26):
  unresolved live-write control gaps. This project does not enable live-write.

Package integrity and source revisions are machine recorded in `sources/source-lock.json`.
