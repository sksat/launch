import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { loginAs, logout } from "./helpers/auth";

const FIXTURE = resolve(import.meta.dirname, "fixtures/test-image.jpg");

test("user can upload a site image and it's served via /sites/:slug/image with cache headers", async ({
	page,
}) => {
	await loginAs(page, "pepepper");
	const slug = `upload-${Date.now().toString(36)}`;

	await page.goto("/sites/new");
	await page.locator('input[name="name"]').fill(`Upload Test ${slug}`);
	await page.locator('input[name="slug"]').fill(slug);
	await page.locator('input[name="visibility"][value="authenticated"]').check();
	await page.getByRole("button", { name: "Create Site" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	await page.setInputFiles('input[type="file"][name="image"]', FIXTURE);
	await page.getByRole("button", { name: "Upload Image" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	const hero = page.locator("section img").first();
	await expect(hero).toBeVisible();
	const src = await hero.getAttribute("src");
	// Worker-proxied route, not a direct R2 URL. `?v=` is a cache-buster.
	expect(src).toMatch(new RegExp(`^/sites/${slug}/image\\?v=`));

	const res = await page.request.get(src!);
	expect(res.status()).toBe(200);
	expect(res.headers()["content-type"]).toContain("image/jpeg");
	// authenticated visibility → edge shared cache disabled
	expect(res.headers()["cloudflare-cdn-cache-control"]).toContain("no-store");
	const body = await res.body();
	expect(body.byteLength).toBeGreaterThan(1000);
});

test("uploaded image on a private site is hidden from other users", async ({ page }) => {
	await loginAs(page, "pepepper");
	const slug = `priv-upload-${Date.now().toString(36)}`;

	await page.goto("/sites/new");
	await page.locator('input[name="name"]').fill(`Private Upload ${slug}`);
	await page.locator('input[name="slug"]').fill(slug);
	await page.locator('input[name="visibility"][value="private"]').check();
	await page.getByRole("button", { name: "Create Site" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	await page.setInputFiles('input[type="file"][name="image"]', FIXTURE);
	await page.getByRole("button", { name: "Upload Image" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	const hero = page.locator("section img").first();
	const imageUrl = (await hero.getAttribute("src"))!;
	expect(imageUrl).toMatch(new RegExp(`^/sites/${slug}/image\\?v=`));

	// Switch user — should be denied.
	await logout(page);
	await loginAs(page, "sksat");
	const res = await page.request.get(imageUrl);
	expect(res.status()).toBe(403);
});
