import { spawn } from "node:child_process";
import { BrowserHost, type CapabilityResult, type SetupOptions } from "mcp-apps-conformance";
import { type Browser, chromium, type Page } from "playwright";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const APP = process.env.GOOSE_APP ?? "/Applications/Goose.app";
const PORT = Number(process.env.GOOSE_CDP_PORT ?? 9222);
const ENDPOINT = `http://127.0.0.1:${PORT}`;

/**
 * Everything Goose-specific, in one class. Goose is an Electron desktop app, so
 * the only real difference from a web host is `open()`: instead of launching
 * Chrome and navigating, we relaunch Goose with `--remote-debugging-port` and
 * attach over CDP (`_electron.launch` can't attach — the launcher stub re-execs
 * the real process). The base `BrowserHost` does the rest.
 */
export class GooseHost extends BrowserHost {
	readonly name = "goose";
	readonly url = "goose-desktop"; // unused — open() attaches, doesn't navigate
	// Broad on purpose: the base finds the live app frame by its channel.
	readonly widgetSelector = "iframe";

	private browser?: Browser;

	// Goose is single-instance, so quit any running copy before relaunching it
	// with the CDP port.
	protected async open(_opts: SetupOptions): Promise<void> {
		await this.quitGoose();
		await sleep(1_500);
		spawn("open", ["-a", APP, "--args", `--remote-debugging-port=${PORT}`], {
			stdio: "ignore",
			detached: true,
		}).unref();

		const deadline = Date.now() + 30_000;
		let up = false;
		while (!up && Date.now() < deadline) {
			up = await fetch(`${ENDPOINT}/json/version`).then((r) => r.ok, () => false);
			if (!up) await sleep(1_000);
		}
		if (!up) throw new Error(`Goose CDP endpoint never came up on ${ENDPOINT}`);

		this.browser = await chromium.connectOverCDP(ENDPOINT);
		this.context = this.browser.contexts()[0];
		this.page =
			this.context.pages()[0] ?? (await this.context.waitForEvent("page", { timeout: 15_000 }));
		await this.page.waitForLoadState("domcontentloaded").catch(() => {});
	}

	async teardown(): Promise<void> {
		await this.browser?.close().catch(() => {}); // disconnects CDP, doesn't quit the app
		await this.quitGoose();
	}

	private quitGoose(): Promise<void> {
		return new Promise((resolve) => {
			const p = spawn("pkill", ["-f", APP], { stdio: "ignore" });
			p.on("close", () => resolve());
			p.on("error", () => resolve());
		});
	}

	// Goose opens ui/open-link in the OS browser (shell.openExternal), outside our
	// CDP context — unobservable, so SKIP rather than a false FAIL.
	async checkLinkOpen(url: string): Promise<CapabilityResult> {
		const r = await super.checkLinkOpen(url);
		return r.ok ? r : { ok: false, unsupported: true };
	}

	// No login/consent modal in the desktop app.
	protected async dismissModal(_page: Page): Promise<void> {}

	protected async sendPrompt(page: Page, _appName: string): Promise<void> {
		const input = page.locator('textarea[data-testid="chat-input"]');
		await input.click({ timeout: 30_000 });
		await input.fill("Run the MCP Apps conformance test suite using the run_conformance tool.");
		await sleep(500);
		await page.keyboard.press("Enter");
	}

	// The transcript lives in the renderer DOM, so scan it for the marker.
	protected async verifyConversation(
		page: Page,
		marker: string,
		timeoutMs: number,
	): Promise<boolean> {
		return this.pollMarker(
			page,
			(m: string) => ((globalThis as any).document.body.innerText.includes(m) ? "found" : "not-found"),
			marker,
			timeoutMs,
			6_000,
		);
	}
}
