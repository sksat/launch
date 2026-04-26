import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { wranglerExec } from "./helpers/seed";

/**
 * The hero's bottom-left block stacks four visible things:
 *   - T- countdown (font-mono, tracking-[0.18em])
 *   - Mission callsign h1 (.hero-title, letter-spacing -0.5px)
 *   - Mission title (default body font)
 *   - "View Mission" CTA anchor (bordered button)
 *
 * All four must share the same left edge — any drift looks sloppy in the
 * cinematic hero.
 */
// Earlier tests in the suite may have seeded missions whose schedule
// sorts them ahead of ours — the "featured" slot on / then picks one of
// theirs, which doesn't carry the `View Mission` CTA layout this test
// measures. Wipe mission rows before this file runs.
test.beforeAll(async () => {
	wranglerExec(`
		DELETE FROM schedule_votes;
		DELETE FROM schedule_poll_options;
		DELETE FROM schedule_polls;
		DELETE FROM mission_participants;
		DELETE FROM missions;
	`);
});

test("home hero: T-, callsign, title, and CTA share one left edge", async ({
	page,
}) => {
	// Default viewport is 1280x720 → md: breakpoint active
	await page.setViewportSize({ width: 1280, height: 720 });

	await loginAs(page, "pepepper");

	// Seed one mission — with state wiped in globalSetup, this becomes the
	// featured mission on the home page.
	await page.goto("/missions/new");
	// radios are hidden (sr-only) — check with force
	await page
		.locator('input[name="template_id"][value="refueling"]')
		.check({ force: true });
	const future = new Date();
	future.setDate(future.getDate() + 1);
	future.setHours(12, 0, 0, 0);
	const iso = future.toISOString().slice(0, 16);
	await page.locator('input[name="title"]').fill("Ramen Run");
	await page.locator('input[name="scheduled_at"]').fill(iso);
	await page.locator('input[name="target_orbit"]').fill("Ramen Shop");
	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9A-Za-z]{8}$/);

	// Navigate to home where the featured mission (whichever one ends up
	// first) renders in the MissionHero with a "View Mission" CTA. The
	// alignment test is structural — it doesn't rely on which mission is
	// featured, only that the four hero elements share a left edge.
	await page.goto("/");

	// Wait for reveal animations AND the ink-alignment script (which runs
	// after document.fonts.ready and writes text-indent onto [data-align-ink]).
	await page.waitForFunction(() => {
		const btn = document.querySelector(".reveal-button");
		if (!btn || getComputedStyle(btn).opacity !== "1") return false;
		const h1 = document.querySelector("h1.hero-title[data-align-ink]") as HTMLElement | null;
		// text-indent is empty string until the alignment script writes it.
		return !!h1 && h1.style.textIndent !== "";
	});

	// Scope to the MissionHero section (first <section>) so we don't pick
	// up elements from the "Upcoming Launches" table below.
	const hero = page.locator("section").first();
	const countdown = hero.locator("[data-tminus]");
	const h1 = hero.locator("h1.hero-title");
	// Mission title subheader inside the hero (not the eyebrow, which also
	// carries data-align-ink — disambiguate by the sibling class).
	const title = hero.locator(".reveal-subheader.text-base").first();
	const cta = hero.getByRole("link", { name: "View Mission" });

	await expect(countdown).toBeVisible();
	await expect(h1).toBeVisible();
	await expect(title).toBeVisible();
	await expect(cta).toBeVisible();

	/**
	 * What the eye lines up: for text rows, the visual ink edge of the first
	 * glyph (which can sit right of the CSS box if the font's left-side
	 * bearing is non-zero — e.g. D-DIN "L" at 160px has LSB ≈ 9px). For the
	 * CTA, the button's outer border-box left. All four must match.
	 */
	const measureInkLeft = (el: Element): number => {
		const rect = el.getBoundingClientRect();
		const text = el.textContent?.trim() ?? "";
		if (!text) return rect.left;
		const cs = getComputedStyle(el);
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) return rect.left;
		ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
		const metrics = ctx.measureText(text[0]);
		// actualBoundingBoxLeft is positive going LEFT from the alignment
		// point; negative means ink sits inside the box (positive LSB).
		// Include text-indent since our alignment script applies it to pull
		// ink back to the box's left edge.
		const indent = parseFloat(cs.textIndent) || 0;
		return rect.left + indent - metrics.actualBoundingBoxLeft;
	};

	const lefts = {
		countdown: await countdown
			.locator("> span")
			.first()
			.evaluate(measureInkLeft),
		h1: await h1.evaluate(measureInkLeft),
		title: await title.evaluate(measureInkLeft),
		cta: (await cta.boundingBox())!.x,
	};

	console.log("hero left edges:", lefts);

	const values = Object.values(lefts);
	const spread = Math.max(...values) - Math.min(...values);
	expect(spread, JSON.stringify(lefts)).toBeLessThanOrEqual(1);
});
