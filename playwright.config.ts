import { defineConfig } from "@playwright/test";

// Distinct from dev's 5180 so E2E can run while a `pnpm dev` is open.
// Must match the E2E branch in vite.config.ts.
const PORT = 5190;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: false, // shared D1/R2 state — run serially for determinism
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? "github" : "list",
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "pnpm dev",
		url: BASE_URL,
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			// Switches vite.config + the cloudflare plugin to the E2E state
			// directory. See also WRANGLER_PERSIST_TO in global-setup.
			LAUNCH_E2E: "1",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
});
