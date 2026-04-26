import type { Page, APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { generateShortId } from "../../../src/lib/short-id";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// Honors the same path as the cloudflare() plugin in vite.config (which
// reads LAUNCH_E2E=1 to switch). Seeding tests that talk to D1 must hit
// the SAME state dir as the running Worker — otherwise the Worker sees
// an empty database and tests flake or explode.
const PERSIST_TO = process.env.WRANGLER_PERSIST_TO || ".wrangler-e2e/state";

function persistArgs(): string[] {
	return ["--persist-to", PERSIST_TO];
}

export function wranglerExec(sql: string): void {
	const r = spawnSync(
		"pnpm",
		[
			"wrangler",
			"d1",
			"execute",
			"launch-db",
			"--local",
			...persistArgs(),
			"--command",
			sql,
		],
		{ cwd: REPO_ROOT, stdio: "pipe" },
	);
	if (r.status !== 0) {
		throw new Error(
			`wrangler d1 failed (${r.status}): ${r.stderr?.toString() ?? ""}`,
		);
	}
}

export async function pepepperId(): Promise<number> {
	const r = spawnSync(
		"pnpm",
		[
			"wrangler",
			"d1",
			"execute",
			"launch-db",
			"--local",
			...persistArgs(),
			"--command",
			"SELECT id FROM users WHERE login = 'pepepper' LIMIT 1",
			"--json",
		],
		{ cwd: REPO_ROOT },
	);
	const parsed = JSON.parse(r.stdout.toString()) as Array<{
		results: Array<{ id: number }>;
	}>;
	const id = parsed[0]?.results[0]?.id;
	if (!id) throw new Error("pepepper user not found — login first");
	return id;
}

/**
 * Seed a plain refueling mission via the UI. Creates a mission roughly a
 * day in the future with a predictable title/route for tests that only
 * need a featured mission to exist.
 */
export async function seedRefuelingMission(
	page: Page,
	opts: { title?: string; targetOrbit?: string } = {},
): Promise<void> {
	const title = opts.title ?? `Hero seed ${Date.now().toString(36)}`;
	await page.goto("/missions/new");
	await page
		.locator('input[name="template_id"][value="refueling"]')
		.check({ force: true });
	const future = new Date();
	future.setDate(future.getDate() + 1);
	future.setHours(12, 0, 0, 0);
	await page.locator('input[name="title"]').fill(title);
	await page
		.locator('input[name="scheduled_at"]')
		.fill(future.toISOString().slice(0, 16));
	await page
		.locator('input[name="target_orbit"]')
		.fill(opts.targetOrbit ?? "Restaurant");
	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9A-Za-z]{8}$/);
}

/**
 * Seed a mission whose launch_site is a google_places-sourced "ZEYO".
 * Uses direct SQL seeding (faster + deterministic). The mock Places
 * server returns the fixture JPEG for `places/ChIJmockPlace/photos/mockPhoto`,
 * which is what the /sites/:slug/photo proxy will fetch when this mission's
 * hero is rendered.
 */
export async function seedZeyoMission(
	page: Page,
	opts: { siteSlug?: string; missionTitle?: string } = {},
): Promise<{ siteSlug: string; missionId: number }> {
	const uid = await pepepperId();
	const siteSlug = opts.siteSlug ?? `zeyo-${Date.now().toString(36)}`;
	const missionTitle = opts.missionTitle ?? "ZEYO Curry Udon Run";

	wranglerExec(
		`INSERT INTO sites (slug, name, visibility, image_source, google_place_id, google_photo_name, google_attribution, created_by)
		 VALUES ('${siteSlug}', 'カレーうどん ZEYO.', 'authenticated', 'google_places', 'ChIJmockPlace', 'places/ChIJmockPlace/photos/mockPhoto', 'Mock Photographer', ${uid})`,
	);

	await page.goto("/missions/new");
	await page
		.locator('input[name="template_id"][value="refueling"]')
		.check({ force: true });
	const future = new Date();
	future.setDate(future.getDate() + 1);
	future.setHours(12, 0, 0, 0);
	await page.locator('input[name="title"]').fill(missionTitle);
	await page
		.locator('input[name="scheduled_at"]')
		.fill(future.toISOString().slice(0, 16));
	await page
		.locator('select[name="launch_site_id"]')
		.selectOption({ label: "カレーうどん ZEYO." });
	await page.locator('input[name="target_orbit"]').fill("ZEYO");
	await page.getByRole("button", { name: "Create Mission" }).click();
	await expect(page).toHaveURL(/\/missions\/[0-9A-Za-z]{8}$/);
	const url = page.url();
	const missionId = Number(url.match(/\/missions\/(\d+)$/)![1]);
	return { siteSlug, missionId };
}

/**
 * Faster variant: seeds BOTH the site and mission via direct SQL (no UI
 * form submission). Use in tests that don't need to exercise the form
 * flow — e.g. hero-fold which only asserts rendering once the mission
 * exists. Login as the target user first so their record exists.
 */
export async function seedZeyoMissionSQL(opts: {
	userLogin?: string;
	siteSlug?: string;
	missionTitle?: string;
} = {}): Promise<{ siteSlug: string; missionId: number; missionExternalId: string }> {
	const uid = await pepepperId();
	const siteSlug = opts.siteSlug ?? `zeyo-${Date.now().toString(36)}`;
	const missionTitle = (opts.missionTitle ?? "ZEYO Curry Udon Run").replace(
		/'/g,
		"''",
	);
	const future = new Date();
	future.setDate(future.getDate() + 1);
	future.setHours(12, 0, 0, 0);
	const scheduledAt = future.toISOString().slice(0, 19).replace("T", " ");

	// Use a test-scoped synthetic callsign (namespaced "ZEYOTEST-") so this
	// helper never collides with an `L-12` created by an earlier test going
	// through the UI. The external_id is the primary identity; callsign/seq
	// are just there to satisfy the UNIQUE constraint.
	const seedExternalId = generateShortId();
	const seedCallsign = `ZEYOTEST-${seedExternalId}`;
	wranglerExec(
		`INSERT INTO sites (slug, name, visibility, image_source, google_place_id, google_photo_name, google_attribution, created_by)
		 VALUES ('${siteSlug}', 'カレーうどん ZEYO.', 'authenticated', 'google_places', 'ChIJmockPlace', 'places/ChIJmockPlace/photos/mockPhoto', 'Mock Photographer', ${uid})
		 ON CONFLICT(slug) DO NOTHING;`,
	);
	wranglerExec(
		`INSERT INTO missions (external_id, template_id, callsign, seq, title, visibility, scheduled_at, launch_site, launch_site_id, target_orbit, created_by)
		 VALUES ('${seedExternalId}', 'refueling', '${seedCallsign}', 1, '${missionTitle}', 'authenticated', '${scheduledAt}', 'カレーうどん ZEYO.', (SELECT id FROM sites WHERE slug = '${siteSlug}'), 'ZEYO', ${uid});`,
	);

	// Look up by the just-generated external_id — the authoritative URL
	// identity. Callsign/seq collisions between tests would otherwise
	// silently return someone else's row.
	const r = spawnSync(
		"pnpm",
		[
			"wrangler",
			"d1",
			"execute",
			"launch-db",
			"--local",
			...persistArgs(),
			"--command",
			`SELECT id, external_id FROM missions WHERE external_id = '${seedExternalId}' LIMIT 1`,
			"--json",
		],
		{ cwd: REPO_ROOT },
	);
	const parsed = JSON.parse(r.stdout.toString()) as Array<{
		results: Array<{ id: number; external_id: string }>;
	}>;
	const row = parsed[0].results[0];
	return { siteSlug, missionId: row.id, missionExternalId: row.external_id };
}
