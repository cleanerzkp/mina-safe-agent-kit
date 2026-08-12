# Supported Mina source locks

Checked on 12 August 2026.

- Stable o1js: `2.15.0`, npm `latest`, Apache-2.0.
- Experimental o1js: `3.0.0-mesa.rc2`; never replace the stable lane silently.
- Official Mina MCP: `@o1-labs/mina-mcp-server@0.7.3`, Apache-2.0.
- Runtime floor: Node 20.18.0 from the MCP package; this repository tests Node 24.

Primary references:

- [Official o1js compile, prove, and verify example](https://github.com/o1-labs/o1js/blob/a6fe4871dc5bccfc553ce9a08f63c97758b2722c/src/examples/zkprogram/program-with-input.ts)
- [Official Mina MCP README](https://github.com/MinaProtocol/mina-mcp-server/blob/2404419a04743de36637743d1187cfe424586d67/README.md)
- [Official Mina MCP security policy](https://github.com/MinaProtocol/mina-mcp-server/blob/2404419a04743de36637743d1187cfe424586d67/SECURITY.md)
- [Mina secure zkApp guidance](https://docs.minaprotocol.com/zkapps/writing-a-zkapp/introduction-to-zkapps/secure-zkapps)

The skill provides operational guardrails. It is not a static analyzer, an audit, a wallet, or a proof of application security.

Use `sources/source-lock.json` as the machine-readable authority for versions and package integrity.
