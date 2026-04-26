import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test("mission form shows registered sites and mission detail links to chosen site", async ({
	page,
}) => {
	await loginAs(page, "pepepper");

	await page.goto("/missions/new");

	await page.locator('input[name="title"]').fill("E2E rideshare mission");
	await page
		.locator('select[name="launch_site_id"]')
		.selectOption({ label: "Tsukuba — Building A Parking Lot (default)" });
	await page.locator('input[name="target_orbit"]').fill("Ariake");
	// rideshare template needs a scheduled time for its hour-based callsign.
	const future = new Date();
	future.setDate(future.getDate() + 1);
	future.setHours(5, 0, 0, 0);
	await page
		.locator('input[name="scheduled_at"]')
		.fill(future.toISOString().slice(0, 16));

	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9A-Za-z]{8}$/);

	// Mission detail shows the site name, linked to /sites/tsukuba-bldg-a
	const siteLink = page.getByRole("link", {
		name: "Tsukuba — Building A Parking Lot",
	});
	await expect(siteLink).toBeVisible();
	await expect(siteLink).toHaveAttribute("href", "/sites/tsukuba-bldg-a");

	// Hero image uses the site's image_url from sites.json
	const hero = page.locator("section img").first();
	await expect(hero).toBeVisible();
	await expect(hero).toHaveAttribute("src", /tsukuba-h2\.jpg/);
});
