import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

async function pickVisitTemplate(page: import("@playwright/test").Page) {
	// The radio is sr-only; the wrapping label carries the visible "V" text.
	await page
		.locator('label:has(input[name="template_id"][value="visit"])')
		.click();
}

test("Visit mission: launch site omitted, target uses unified sites registry", async ({
	page,
}) => {
	await loginAs(page, "pepepper");

	// Register ZEYO as a site; the target select for Visit missions pulls
	// from the same `sites` table (no separate targets registry).
	const slug = `zeyo-${Date.now().toString(36)}`;
	const name = `ZEYO ${slug}`;
	await page.goto("/sites/new");
	await page.locator('input[name="name"]').fill(name);
	await page.locator('input[name="slug"]').fill(slug);
	await page
		.locator('input[name="visibility"][value="authenticated"]')
		.check();
	await page.getByRole("button", { name: "Create Site" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	await page.goto("/missions/new");
	await pickVisitTemplate(page);

	await page.locator('input[name="title"]').fill("ZEYO 行くぞ");
	// launch_site is intentionally left blank — the whole point of Visit
	// missions is that the launch site doesn't matter.
	await page
		.locator('select[name="target_id"]')
		.selectOption({ label: name });

	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);

	// Mission detail shows the target name, linked into the unified site
	// registry.
	const targetLink = page.getByRole("link", { name });
	await expect(targetLink).toBeVisible();
	await expect(targetLink).toHaveAttribute("href", `/sites/${slug}`);

	// Launch site row should render the empty placeholder ("—") since we
	// didn't supply one.
	const launchSiteCell = page
		.locator("dt", { hasText: "Launch Site" })
		.locator("xpath=following-sibling::dd[1]");
	await expect(launchSiteCell).toHaveText("—");
});

test("Visit mission hero uses the target site's image when launch site is absent", async ({
	page,
}) => {
	await loginAs(page, "pepepper");

	// Register a site with a concrete image_url so we can assert the hero
	// <img> src points at it (rather than the Tsukuba H-II fallback).
	const slug = `viz-${Date.now().toString(36)}`;
	const targetImg = `https://example.com/${slug}-hero.jpg`;
	await page.goto("/sites/new");
	await page.locator('input[name="name"]').fill(`Visual ${slug}`);
	await page.locator('input[name="slug"]').fill(slug);
	await page.locator('input[name="image_url"]').fill(targetImg);
	await page
		.locator('input[name="visibility"][value="authenticated"]')
		.check();
	await page.getByRole("button", { name: "Create Site" }).click();
	await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

	// Create a Visit mission with no launch_site, just this site as target.
	await page.goto("/missions/new");
	await pickVisitTemplate(page);
	await page.locator('input[name="title"]').fill(`Hero from target ${slug}`);
	await page
		.locator('select[name="target_id"]')
		.selectOption({ label: `Visual ${slug}` });
	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);

	// The first <img> on the page is the mission hero. With no launch site
	// to draw from, pickHeroImage should fall back to the target site's
	// image_url rather than the Tsukuba H-II default.
	const hero = page.locator("section img").first();
	await expect(hero).toBeVisible();
	await expect(hero).toHaveAttribute("src", targetImg);
});
