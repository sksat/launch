import { cloudflare } from "@cloudflare/vite-plugin";
import build from "@hono/vite-build/cloudflare-workers";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command, isSsrBuild }) => {
	if (command === "serve") {
		// Isolate E2E state (D1 + R2) from local dev state so `pnpm test:e2e`
		// can freely wipe its fixtures without stomping whatever you're
		// tinkering with in a browser.
		const e2e = process.env.LAUNCH_E2E === "1";
		// E2E uses a separate port so it can run alongside a regular `pnpm dev`.
		const port = e2e ? 5190 : 5180;
		return {
			server: { port, strictPort: true },
			plugins: [
				cloudflare(
					e2e ? { persistState: { path: ".wrangler-e2e/state" } } : {},
				),
				tailwindcss(),
			],
		};
	}
	// Client build: compile CSS and static assets into dist/
	if (!isSsrBuild) {
		return {
			build: {
				rollupOptions: {
					input: ["./src/style.css"],
					output: {
						assetFileNames: "assets/[name].[ext]",
					},
				},
			},
			plugins: [tailwindcss()],
		};
	}
	// SSR build: bundle the Hono app for Cloudflare Workers
	return {
		plugins: [build({ outputDir: "dist-server" }), tailwindcss()],
	};
});
