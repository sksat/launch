import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";

const UNIQUE = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test.describe("friends", () => {
	test("request → accept → friends-only mission round-trip", async ({ page }) => {
		// 1. sksat signs in once so a users row exists (pepepper can address them).
		await loginAs(page, "sksat");
		await logout(page);

		// 2. pepepper sends a friend request to sksat.
		await loginAs(page, "pepepper");
		await page.goto("/friends");
		await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
		await page.locator('input[name="login"]').fill("sksat");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page).toHaveURL(/\/friends\?ok=/);
		await expect(page.getByText(/Outgoing Requests/)).toBeVisible();
		await expect(page.getByText("@sksat")).toBeVisible();

		// 3. sksat signs in, sees the incoming request, accepts.
		await logout(page);
		await loginAs(page, "sksat");
		await page.goto("/friends");
		await expect(page.getByText(/Incoming Requests/)).toBeVisible();
		await expect(page.getByText("@pepepper")).toBeVisible();
		await page.getByRole("button", { name: "Accept" }).click();
		await expect(page).toHaveURL(/\/friends\?ok=/);
		// pepepper should now appear in the Friends list, not in incoming.
		await expect(page.getByText(/Incoming Requests/)).toHaveCount(0);
		await expect(page.locator("section").filter({ hasText: /^Friends \(/ }).getByText("@pepepper"))
			.toBeVisible();

		// 4. pepepper creates a friends-only mission, pre-boards sksat.
		await logout(page);
		await loginAs(page, "pepepper");
		await page.goto("/missions/new");
		await page.locator('input[name="template_id"][value="rideshare"]').check({ force: true });
		const title = `friends-only ${UNIQUE()}`;
		await page.locator('input[name="title"]').fill(title);
		// rideshare callsign = T-{hour} so scheduled_at is required.
		const future = new Date();
		future.setDate(future.getDate() + 1);
		future.setHours(5, 0, 0, 0);
		await page
			.locator('input[name="scheduled_at"]')
			.fill(future.toISOString().slice(0, 16));
		await page.locator('input[name="visibility"][value="friends"]').check();
		// pre-board sksat — find the checkbox by associated label text
		const sksatCheckbox = page.locator('label:has-text("@sksat") input[name="crew_ids"]');
		await expect(sksatCheckbox).toBeVisible();
		await sksatCheckbox.check();
		await page.getByRole("button", { name: "Create Mission" }).click();
		await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
		const missionUrl = page.url();
		// sksat should already be in the crew list (auto-boarded). crew-list
		// renders the bare login (no @-prefix) inside font-mono text.
		await expect(page.getByText("sksat", { exact: true }).first()).toBeVisible();

		// 5. sksat can view the mission.
		await logout(page);
		await loginAs(page, "sksat");
		const sksatView = await page.goto(missionUrl);
		expect(sksatView?.status()).toBe(200);
		await expect(page.getByText(title).first()).toBeVisible();

		// 6. pepepper removes sksat; sksat then loses access and sees ACCESS DENIED.
		await logout(page);
		await loginAs(page, "pepepper");
		await page.goto("/friends");
		await page
			.locator("section")
			.filter({ hasText: /^Friends \(/ })
			.getByRole("button", { name: "Remove" })
			.click();
		await expect(page).toHaveURL(/\/friends\?ok=/);

		await logout(page);
		await loginAs(page, "sksat");
		// sksat is still on the crew (participants), so participants visibility wouldn't
		// matter — but visibility is "friends" and friendship was removed. However,
		// sksat is also in mission_participants from step 4. The friends-visibility
		// branch checks friendship of the CREATOR, not membership. Once removed,
		// sksat loses access even though listed as crew. Confirm 403 + ACCESS DENIED UI.
		const sksatAfter = await page.goto(missionUrl);
		expect(sksatAfter?.status()).toBe(403);
		await expect(page.getByText("ACCESS DENIED")).toBeVisible();
	});

	test("self-request is rejected", async ({ page }) => {
		await loginAs(page, "pepepper");
		await page.goto("/friends");
		await page.locator('input[name="login"]').fill("pepepper");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page).toHaveURL(/\/friends\?err=/);
		await expect(page.getByText(/Cannot send a friend request to yourself/)).toBeVisible();
	});

	test("non-allowed-user is rejected", async ({ page }) => {
		await loginAs(page, "pepepper");
		await page.goto("/friends");
		await page.locator('input[name="login"]').fill("octocat");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page).toHaveURL(/\/friends\?err=/);
		await expect(page.getByText(/not on the allowed-users list/)).toBeVisible();
	});

	test("anonymous users are redirected to login from /friends", async ({ page }) => {
		await logout(page);
		const resp = await page.goto("/friends");
		// Either redirected to login or shows the login page directly.
		expect(resp?.url()).toMatch(/\/auth\/login/);
	});
});
