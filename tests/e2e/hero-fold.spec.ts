import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { seedZeyoMissionSQL } from "./helpers/seed";

/**
 * The cinematic-landing invariant: when any hero-bearing page first loads,
 * the user sees only the background image + basic info (countdown, callsign,
 * title, CTA). Mission details live below the fold and require a scroll.
 *
 * Must hold regardless of the source image's aspect ratio (object-cover
 * handles that) and regardless of viewport aspect ratio.
 */

type Size = { name: string; width: number; height: number };

const VIEWPORTS: Size[] = [
	{ name: "desktop-16:9", width: 1280, height: 720 },
	{ name: "desktop-ultrawide", width: 2560, height: 1080 },
	{ name: "laptop-3:2", width: 1440, height: 960 },
	{ name: "mobile-portrait", width: 390, height: 844 },
];

async function waitForRevealsSettled(page: Page): Promise<void> {
	// Wait for all hero reveal-* animations (h1 header, subheader rows, CTA)
	// to settle to opacity 1. reveal-header is always present; reveal-button
	// only on home (when cta is passed). Require every existing reveal-* to
	// be fully opaque.
	await page.waitForFunction(() => {
		const nodes = Array.from(
			document.querySelectorAll(
				".reveal-header,.reveal-subheader,.reveal-button",
			),
		);
		return (
			nodes.length > 0 &&
			nodes.every((n) => getComputedStyle(n).opacity === "1")
		);
	});
}

async function assertFoldInvariant(page: Page, size: Size): Promise<void> {
	// Hero section is the first <section> on the page.
	const hero = page.locator("section").first();
	const main = page.locator("main").first();

	const heroBox = await hero.boundingBox();
	const mainBox = await main.boundingBox();

	expect(heroBox, "hero renders").not.toBeNull();
	expect(mainBox, "main renders").not.toBeNull();

	// Hero starts at viewport top (or 58px spacer clipped via -mt-58)
	expect(
		heroBox!.y,
		`hero top (${heroBox!.y}) should be at viewport top`,
	).toBeLessThanOrEqual(0.5);

	// Hero extends to or past the viewport bottom — nothing else should peek
	// into the initial viewport.
	expect(
		heroBox!.y + heroBox!.height,
		`hero bottom (${heroBox!.y + heroBox!.height}) < viewport (${size.height})`,
	).toBeGreaterThanOrEqual(size.height);

	// Main content's top edge is at or beyond the fold
	expect(
		mainBox!.y,
		`main top (${mainBox!.y}) must be >= viewport height (${size.height})`,
	).toBeGreaterThanOrEqual(size.height);

	// Basic info (h1 callsign) is inside the viewport — user can see it
	const h1 = page.locator("h1.hero-title").first();
	const h1Box = await h1.boundingBox();
	expect(h1Box, "h1 renders").not.toBeNull();
	expect(
		h1Box!.y + h1Box!.height,
		"h1 bottom is within viewport",
	).toBeLessThanOrEqual(size.height);
	expect(h1Box!.y, "h1 top is within viewport").toBeGreaterThanOrEqual(0);
}

async function assertScrollRevealsMain(page: Page, size: Size): Promise<void> {
	await page.evaluate(() => window.scrollTo(0, window.innerHeight));
	const mainBox = await page.locator("main").first().boundingBox();
	expect(
		mainBox!.y,
		"after scrolling one viewport, main content is visible",
	).toBeLessThan(size.height);
}

test.describe("hero fold invariant", () => {
	// Seed ONCE per file. The invariant is about layout/CSS, not per-test
	// state, so all viewport variants share the same mission — avoids 8×
	// wrangler CLI + form submit overhead (was ~40s, now ~3s).
	let missionExternalId = "";
	test.beforeAll(async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await loginAs(page, "pepepper"); // creates the pepepper user row
		await ctx.close();
		const result = await seedZeyoMissionSQL();
		missionExternalId = result.missionExternalId;
	});

	test.beforeEach(async ({ page }) => {
		await loginAs(page, "pepepper");
	});

	for (const size of VIEWPORTS) {
		test(`home: ZEYO hero fills viewport, details below fold (${size.name})`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: size.width, height: size.height });
			await page.goto("/");
			await waitForRevealsSettled(page);
			await assertFoldInvariant(page, size);
			await assertScrollRevealsMain(page, size);
		});

		test(`mission detail: ZEYO hero fills viewport, details below fold (${size.name})`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: size.width, height: size.height });
			await page.goto(`/missions/${missionExternalId}`);
			await waitForRevealsSettled(page);
			await assertFoldInvariant(page, size);
			await assertScrollRevealsMain(page, size);
		});
	}
});
