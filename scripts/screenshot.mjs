import { chromium } from "playwright";

const [, , url, out, opt] = process.argv;
const useAuth = opt === "--auth";

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 1,
	...(useAuth ? { storageState: "/tmp/auth-state.json" } : {}),
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
// Wait for fonts (D-DIN swap) and any reveal animations on the hero
await page.waitForTimeout(1200);

// Scroll the page to trigger every IntersectionObserver-driven reveal,
// then return to the top for the fullPage capture.
await page.evaluate(async () => {
	const h = document.documentElement.scrollHeight;
	const step = Math.max(400, Math.floor(window.innerHeight * 0.6));
	for (let y = 0; y <= h; y += step) {
		window.scrollTo({ top: y, behavior: "instant" });
		await new Promise((r) => setTimeout(r, 60));
	}
	window.scrollTo({ top: 0, behavior: "instant" });
});

// 2.5s safety margin matches the renderer.tsx fallback so any reveal-on-scroll
// element that the IO somehow missed is forced visible before capture.
await page.waitForTimeout(2700);

await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("OK", out);
