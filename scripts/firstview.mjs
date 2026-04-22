import { chromium } from "playwright";
const [,, url, out, opt] = process.argv;
const useAuth = opt === "--auth";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(useAuth ? { storageState: "/tmp/auth-state.json" } : {}),
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("OK", out);
