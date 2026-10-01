#!/usr/bin/env tsx
import { buildResults, Runner, writeResults } from "mcp-apps-conformance";
import { GooseHost } from "./goose-host.js";

const APP_NAME = process.env.APP_NAME ?? "MCP Apps Conformance";

const host = new GooseHost();
const { results, hostInfo } = await new Runner(host, {
	appName: APP_NAME,
	profileDir: ".profile/goose",
}).run();

const data = buildResults(host.name, APP_NAME, results, hostInfo);
const file = writeResults("out", data);

for (const r of results) {
	console.log(r.status.padEnd(8), r.id, r.message ? `— ${r.message}` : "");
}
console.log(
	`\n${host.name}: ` +
		Object.entries(data.counts)
			.filter(([, n]) => n > 0)
			.map(([k, n]) => `${k} ${n}`)
			.join(" · "),
);
if (hostInfo) console.log(`host reported: ${hostInfo.name ?? "?"} ${hostInfo.version ?? ""}`);
console.log(`results → ${file}`);

// Non-zero on any spec violation, so this can gate CI.
process.exit(data.counts.FAIL + data.counts.TIMEOUT > 0 ? 1 : 0);
