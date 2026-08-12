# Read-only Mina MCP profile

Run the profile generator from the installed package:

```sh
node dist/cli.js profile generate --json
```

It emits one `minaSafe` server with:

- the canonical absolute `/usr/bin/env` path as the command;
- `-i` to start Node with an empty environment;
- the canonical absolute Node executable path;
- the canonical absolute compiled policy-launcher path.

Copy the generated JSON directly into the MCP client configuration. Regenerate it after moving or
updating the installation. `profile check` accepts only the exact profile for the current installation.
A bare `mina-safe-mcp` command or any other `PATH`-resolved launcher fails validation.

The JavaScript launcher then resolves exact `@o1-labs/mina-mcp-server@0.7.3`, checks the installed
package version, and supplies fixed arguments: `--mode live --network devnet --transport stdio`.

## Rejected configuration

- all `MINA_MCP_*` environment variables;
- wallet paths and key material;
- mainnet and write opt-ins;
- tutorial mode;
- HTTP transport or a hosted URL;
- user-supplied launcher arguments;
- sibling MCP servers or extra profile fields;
- `PATH`, Node preloads, shell startup files, proxy credentials, and unrelated secrets from the
  ambient environment.

The supported package targets macOS and Linux. Direct execution of the JavaScript launcher is
unsupported because Node processes preload settings before JavaScript can inspect them.

The official server's live mode is read-only unless wallets are provided. Ordinary CI does not test
network reachability and does not claim that the official beta server is production safe. The wrapper
protects only sessions that use the generated profile unchanged.
