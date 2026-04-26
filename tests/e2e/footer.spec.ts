import { expect, test } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";

test.describe("footer — GitHub link", () => {
	test("home page footer has a GitHub source link with correct attributes", async ({
		page,
	}) => {
		await logout(page);
		await page.goto("/");

		const link = page
			.locator("footer")
			.getByRole("link", { name: /view source on github/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", "https://github.com/sksat/launch");
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(link).toHaveAttribute("rel", /noopener/);
		await expect(link).toHaveAttribute("rel", /noreferrer/);
	});

	test("link is also rendered on a site detail page (shared footer)", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		await page.goto("/sites/tsukuba-bldg-a");

		const link = page
			.locator("footer")
			.getByRole("link", { name: /view source on github/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", "https://github.com/sksat/launch");
	});
});
