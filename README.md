# goose-host-conformance

Runs the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) conformance suite against **Goose** (desktop).

This is what adopting [`mcp-apps-conformance`](https://www.npmjs.com/package/mcp-apps-conformance) looks like for an Electron desktop host: a single adapter ([`src/goose-host.ts`](src/goose-host.ts)) plus a runner entry point. The tests, the suite, the `ui://` server and the whole capability protocol come from the package.

## Run it

```bash
npm install
npx playwright install chromium
npm run server &          # http://localhost:3000/mcp
npm run conformance
```

One-off setup: in Goose, add the conformance server as an extension — either the local `http://localhost:3000/mcp` (Goose reaches `localhost` directly, no tunnel needed), `npm run server:stdio` as a command extension, or the hosted `https://mcp-apps-conformance.alpic.live/mcp`.

The runner **quits any running Goose**, relaunches it with `--remote-debugging-port` and attaches over CDP. The adapter prompts the agent to call `run_conformance`, then the suite drives itself. You get a per-test breakdown on stdout, a results file in `out/`, and a **non-zero exit on any FAIL or TIMEOUT** so this can gate CI.

| Env | Default |
|-----|---------|
| `GOOSE_APP` | `/Applications/Goose.app` |
| `GOOSE_CDP_PORT` | `9222` |

macOS only as written (`open -a` / `pkill`).

## What's in here

| File | What |
|------|------|
| [`src/goose-host.ts`](src/goose-host.ts) | The only Goose-specific code: launch + attach over CDP (`open()`), send a prompt, confirm a turn reached the transcript. `ui/open-link` goes to the OS browser, so that test SKIPs. |
| [`src/run.ts`](src/run.ts) | Wires that adapter into the package's `Runner` and writes the results. |

## Results

Cross-host matrix, including Goose: **[alpic-ai.github.io/mcp-app-conformance](https://alpic-ai.github.io/mcp-app-conformance/)**

MIT.
