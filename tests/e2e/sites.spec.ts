import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";

const UNIQUE = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test.describe("launch sites", () => {
	test("default sites render after sites:sync and cannot be edited", async ({ page }) => {
		await loginAs(page, "pepepper");
		await page.goto("/sites");

		await expect(page.getByRole("heading", { name: "Sites" })).toBeVisible();
		await expect(page.getByText("Tsukuba — Building A Parking Lot")).toBeVisible();
		await expect(page.getByText("Ariake — Office")).toBeVisible();
		await expect(page.getByText("Default").first()).toBeVisible();

		await page.getByText("Tsukuba — Building A Parking Lot").click();
		await expect(page).toHaveURL(/\/sites\/tsukuba-bldg-a$/);
		await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: /Delete/i })).toHaveCount(0);
	});

	test("authenticated-visibility defaults are hidden from unauthenticated users", async ({
		page,
	}) => {
		await logout(page);
		await page.goto("/sites");
		await expect(page.getByText("No sites registered yet.")).toBeVisible();
		await expect(page.getByText("Tsukuba — Building A Parking Lot")).toHaveCount(0);
	});

	test("user can create a site via URL and edit it", async ({ page }) => {
		await loginAs(page, "pepepper");
		const slug = UNIQUE();
		const name = `Cafe ${slug}`;

		await page.goto("/sites/new");
		await page.locator('input[name="name"]').fill(name);
		await page.locator('input[name="slug"]').fill(slug);
		await page.locator('textarea[name="description"]').fill("Initial description");
		await page.locator('input[name="image_url"]').fill("https://example.com/x.jpg");
		await page.locator('input[name="visibility"][value="authenticated"]').check();
		await page.getByRole("button", { name: "Create Site" }).click();

		await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));
		await expect(page.getByRole("heading", { name })).toBeVisible();
		await expect(page.getByText("Initial description")).toBeVisible();

		await page.getByRole("link", { name: "Edit" }).click();
		await expect(page).toHaveURL(new RegExp(`/sites/${slug}/edit$`));
		await page.locator('textarea[name="description"]').fill("Updated description");
		await page.getByRole("button", { name: "Update Site" }).click();

		await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));
		await expect(page.getByText("Updated description")).toBeVisible();
	});

	test("private site is visible only to creator", async ({ page }) => {
		await loginAs(page, "pepepper");
		const slug = `priv-${UNIQUE()}`;
		const name = `Pepepper Secret ${slug}`;
		await page.goto("/sites/new");
		await page.locator('input[name="name"]').fill(name);
		await page.locator('input[name="slug"]').fill(slug);
		await page.locator('input[name="visibility"][value="private"]').check();
		await page.getByRole("button", { name: "Create Site" }).click();
		await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

		await page.goto("/sites");
		await expect(page.getByText(name)).toBeVisible();

		await logout(page);
		await loginAs(page, "sksat");
		await page.goto("/sites");
		await expect(page.getByText(name)).toHaveCount(0);

		const response = await page.goto(`/sites/${slug}`);
		expect(response?.status()).toBe(403);
		await expect(page.getByText("ACCESS DENIED")).toBeVisible();
	});

	test("non-owner cannot edit someone else's site", async ({ page }) => {
		await loginAs(page, "pepepper");
		const slug = `own-${UNIQUE()}`;
		await page.goto("/sites/new");
		await page.locator('input[name="name"]').fill("Pepepper Cafe");
		await page.locator('input[name="slug"]').fill(slug);
		await page.locator('input[name="visibility"][value="authenticated"]').check();
		await page.getByRole("button", { name: "Create Site" }).click();
		await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

		await logout(page);
		await loginAs(page, "sksat");
		await page.goto(`/sites/${slug}`);
		await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

		const edit = await page.goto(`/sites/${slug}/edit`);
		expect(edit?.status()).toBe(403);
	});
});
