import { expect, test } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";
import { seedRefuelingMission } from "./helpers/seed";

test.describe("header — top bar layout", () => {
	test("logged-out: top bar shows only logo and Menu button (no nav links visible)", async ({
		page,
	}) => {
		await logout(page);
		await page.goto("/");

		const header = page.locator("#site-header");
		await expect(header).toBeVisible();
		await expect(header.getByRole("link", { name: /^launch/i })).toBeVisible();

		const toggle = page.locator("#menu-toggle");
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute("aria-expanded", "false");

		// The mega menu exists in the DOM but is closed (translateY(-100%) → not in viewport).
		const menu = page.locator("#mega-menu");
		await expect(menu).toHaveAttribute("aria-hidden", "true");

		// Critically: nothing from the menu (Missions / Sites / Sign In) is
		// reachable inside the visible top bar.
		await expect(header.getByRole("link", { name: "Missions", exact: true })).toHaveCount(0);
		await expect(header.getByRole("link", { name: "Sites" })).toHaveCount(0);
		await expect(header.getByRole("link", { name: /sign in/i })).toHaveCount(0);
	});

	test("logged-in: top bar still shows only logo and Menu button", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		await page.goto("/");

		const header = page.locator("#site-header");
		await expect(header.getByRole("button", { name: /logout/i })).toHaveCount(
			0,
		);
		await expect(header.getByText("pepepper")).toHaveCount(0);
		await expect(page.locator("#menu-toggle")).toBeVisible();
	});
});

test.describe("header — mega menu interactions", () => {
	test("clicking Menu opens the dropdown with Missions / Sites / Sign In", async ({
		page,
	}) => {
		await logout(page);
		await page.goto("/");

		const toggle = page.locator("#menu-toggle");
		const menu = page.locator("#mega-menu");

		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(menu).toHaveAttribute("aria-hidden", "false");
		await expect(menu).toHaveClass(/open/);

		await expect(menu.getByRole("link", { name: "Missions", exact: true })).toBeVisible();
		await expect(menu.getByRole("link", { name: "Sites" })).toBeVisible();
		await expect(menu.getByRole("link", { name: /sign in/i })).toBeVisible();
		// "Upcoming Missions" widget heading is always rendered when there is at
		// least one upcoming mission. With a fresh DB it may be absent, so just
		// assert the "All …" CTA OR the heading is present (or neither, gracefully).
		// The dedicated widget test below seeds a mission and asserts the rich UI.
	});

	test("ESC closes the mega menu", async ({ page }) => {
		await logout(page);
		await page.goto("/");

		await page.locator("#menu-toggle").click();
		await expect(page.locator("#mega-menu")).toHaveClass(/open/);

		await page.keyboard.press("Escape");
		await expect(page.locator("#menu-toggle")).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		await expect(page.locator("#mega-menu")).not.toHaveClass(/open/);
	});

	test("clicking outside closes the mega menu", async ({ page }) => {
		await logout(page);
		await page.goto("/");

		await page.locator("#menu-toggle").click();
		await expect(page.locator("#mega-menu")).toHaveClass(/open/);

		// Click on the page body, away from header & menu.
		await page.mouse.click(10, 600);
		await expect(page.locator("#mega-menu")).not.toHaveClass(/open/);
	});

	test("clicking Missions link navigates and closes the menu", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		await page.goto("/");

		await page.locator("#menu-toggle").click();
		await page
			.locator("#mega-menu")
			.getByRole("link", { name: "Missions", exact: true })
			.click();

		await expect(page).toHaveURL(/\/missions$/);
		await expect(page.locator("#mega-menu")).not.toHaveClass(/open/);
		await expect(page.locator("#menu-toggle")).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	test("logged-in mega menu shows username and Logout (not Sign In)", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		await page.goto("/");
		await page.locator("#menu-toggle").click();

		const menu = page.locator("#mega-menu");
		await expect(menu.getByText("pepepper")).toBeVisible();
		await expect(menu.getByRole("button", { name: /logout/i })).toBeVisible();
		await expect(menu.getByRole("link", { name: /sign in/i })).toHaveCount(0);
	});
});

test.describe("header — upcoming missions widget", () => {
	test("shows seeded upcoming missions inside the mega menu", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		const title = `Hero ${Date.now().toString(36)}`;
		await seedRefuelingMission(page, { title });

		await page.goto("/sites"); // load on a non-/ page to verify it's global
		await page.locator("#menu-toggle").click();
		const menu = page.locator("#mega-menu");
		await expect(menu).toHaveClass(/open/);

		// Widget heading + the seeded mission title + "All Upcoming Missions" CTA.
		await expect(menu.getByText("Upcoming Missions").first()).toBeVisible();
		await expect(menu.getByText(title)).toBeVisible();
		await expect(
			menu.getByRole("link", { name: /all upcoming missions/i }),
		).toBeVisible();

		// Each mission renders as a clickable card pointing at its detail page.
		const cardLink = menu.locator(
			'a[href^="/missions/"]:not([href="/missions"])',
		);
		await expect(cardLink.first()).toBeVisible();
	});
});
