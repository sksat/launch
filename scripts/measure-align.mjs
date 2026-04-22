import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: "/tmp/auth-state.json",
});
const page = await ctx.newPage();
await page.goto("http://localhost:5180/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const out = {};
  ["[data-tminus]", ".hero-title", "section .reveal-button"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      out[sel] = { left: r.left, right: r.right, width: r.width, top: r.top };
    }
  });
  // Also grab the "Ramen Run" div (the subtitle)
  const subtitle = Array.from(document.querySelectorAll("section .reveal-subheader"))
    .map(el => ({ text: el.textContent.trim().slice(0, 30), left: el.getBoundingClientRect().left }));
  out.subheaders = subtitle;
  return out;
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
