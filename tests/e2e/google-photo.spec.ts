import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { pepepperId, wranglerExec } from "./helpers/seed";

test.describe("google places photo integration", () => {
	/**
	 * Auto-fetch flow (happy path): creating a site with `auto_fetch=on`
	 * routes the Worker to the mock Places server (via GOOGLE_PLACES_BASE_URL
	 * in .dev.vars.e2e). The mock returns a stubbed place with one photo,
	 * and `/sites/:slug/photo` proxies the mock's JPEG bytes back to the
	 * browser. This is the bit that was previously untestable.
	 */
	test("auto-fetch populates google_places metadata and /photo serves bytes", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		const slug = `zeyo-${Date.now().toString(36)}`;

		await page.goto("/sites/new");
		await page.locator('input[name="name"]').fill(`ZEYO ${slug}`);
		await page.locator('input[name="slug"]').fill(slug);
		await page.locator('input[name="address"]').fill("茨城県つくば市");
		await page.locator('input[name="visibility"][value="authenticated"]').check();
		await page.locator('input[name="auto_fetch"]').check();
		await page.getByRole("button", { name: "Create Site" }).click();
		await expect(page).toHaveURL(new RegExp(`/sites/${slug}$`));

		// Attribution must be shown alongside Google-sourced imagery (TOS)
		await expect(
			page.getByText(/Photo © Mock Photographer via Google/i),
		).toBeVisible();

		// Hero image points at the proxy route
		const hero = page.locator("section img").first();
		await expect(hero).toBeVisible();
		await expect(hero).toHaveAttribute(
			"src",
			new RegExp(`/sites/${slug}/photo\\?v=`),
		);

		// Proxy fetches bytes from the mock and returns them to the browser
		const res = await page.request.get(`/sites/${slug}/photo`);
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("image/jpeg");
		const body = await res.body();
		expect(body.byteLength).toBeGreaterThan(1000);
	});

	test("second /photo request serves from R2 cache (no extra Google hit)", async ({
		page,
		request,
	}) => {
		await loginAs(page, "pepepper");
		const slug = `cache-${Date.now().toString(36)}`;

		// Seed a google_places site directly — flow-agnostic fixture setup.
		const uid = await pepepperId();
		wranglerExec(
			`INSERT INTO sites (slug, name, visibility, image_source, google_place_id, google_photo_name, google_attribution, created_by)
			 VALUES ('${slug}', 'Cache Test ${slug}', 'authenticated', 'google_places', 'ChIJmockPlace', 'places/ChIJmockPlace/photos/mockPhoto', 'Mock Photographer', ${uid})`,
		);

		// Reset the mock's call log so we only count THIS test's fetches
		const reset = await request.fetch("http://localhost:5181/_calls", {
			method: "DELETE",
		});
		expect(reset.status()).toBe(204);

		// First GET → cache MISS, hits Google (mock) exactly once
		const first = await page.request.get(`/sites/${slug}/photo`);
		expect(first.status()).toBe(200);
		expect(first.headers()["x-cache"]).toBe("MISS");

		// Second GET → cache HIT, does NOT hit Google again
		const second = await page.request.get(`/sites/${slug}/photo`);
		expect(second.status()).toBe(200);
		expect(second.headers()["x-cache"]).toBe("HIT");

		const callsRes = await request.get("http://localhost:5181/_calls");
		const calls = (await callsRes.json()) as Array<{ method: string; path: string }>;
		const photoFetches = calls.filter(
			(c) => c.method === "GET" && /\/media/.test(c.path),
		);
		expect(photoFetches).toHaveLength(1);
	});

	test("attribution badge appears on the site card in the list", async ({
		page,
	}) => {
		await loginAs(page, "pepepper");
		const slug = `zeyo-list-${Date.now().toString(36)}`;

		// Seed directly — we already covered auto-fetch in the other test.
		const uid = await pepepperId();
		wranglerExec(
			`INSERT INTO sites (slug, name, visibility, image_source, google_place_id, google_photo_name, google_attribution, created_by)
			 VALUES ('${slug}', 'ZEYO List ${slug}', 'authenticated', 'google_places', 'ChIJmockPlace', 'places/ChIJmockPlace/photos/mockPhoto', 'Mock Photographer', ${uid})`,
		);

		await page.goto("/sites");
		const card = page.getByRole("link", {
			name: new RegExp(`ZEYO List ${slug}`, "i"),
		});
		await expect(card).toBeVisible();
		await expect(card.getByText(/Mock Photographer.*Google/)).toBeVisible();
		await expect(
			card.locator(`img[src^="/sites/${slug}/photo?v="]`),
		).toBeVisible();
	});
});
