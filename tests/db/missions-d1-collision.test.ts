// Pins the assumption that backs `isExternalIdCollision` in src/db/missions.ts:
// when D1 raises a UNIQUE violation on `missions.external_id`, the error
// message contains the substring our regex matches. If a future workerd /
// D1 revision changes that wording, the retry path silently disengages and
// createMission starts surfacing 500s — this test fails first instead.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { isExternalIdCollision } from "../../src/db/missions";

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
	mf = new Miniflare({
		modules: true,
		script: "export default { fetch() { return new Response('ok'); } };",
		d1Databases: { DB: ":memory:" },
	});
	db = await mf.getD1Database("DB");
	// Minimal slice of the missions schema — only the columns and UNIQUE
	// constraints the test needs. Keeping it inline (rather than running the
	// real migrations) avoids dragging FK targets like users/sites in.
	await db.exec(
		`CREATE TABLE missions (id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT, template_id TEXT NOT NULL, callsign TEXT NOT NULL, seq INTEGER NOT NULL, title TEXT NOT NULL, visibility TEXT NOT NULL, created_by INTEGER NOT NULL)`,
	);
	await db.exec(`CREATE UNIQUE INDEX idx_missions_external_id ON missions (external_id)`);
	await db.exec(`CREATE UNIQUE INDEX idx_missions_callsign_seq ON missions (callsign, seq)`);
});

afterAll(async () => {
	await mf.dispose();
});

describe("isExternalIdCollision against real D1", () => {
	it("matches the error D1 throws on external_id UNIQUE collision", async () => {
		const fixedId = "TESTDUP1";
		await db
			.prepare(
				`INSERT INTO missions (external_id, template_id, callsign, seq, title, visibility, created_by)
				 VALUES (?, 'rideshare', 'COL-A', 1, 'first', 'authenticated', 1)`,
			)
			.bind(fixedId)
			.run();

		let caught: unknown;
		try {
			await db
				.prepare(
					`INSERT INTO missions (external_id, template_id, callsign, seq, title, visibility, created_by)
					 VALUES (?, 'rideshare', 'COL-B', 1, 'second', 'authenticated', 1)`,
				)
				.bind(fixedId)
				.run();
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(Error);
		expect(isExternalIdCollision(caught)).toBe(true);
	});

	it("rejects a callsign+seq collision so the retry loop doesn't spin on it", async () => {
		await db
			.prepare(
				`INSERT INTO missions (external_id, template_id, callsign, seq, title, visibility, created_by)
				 VALUES ('cseqA001', 'rideshare', 'COL-C', 1, 'first', 'authenticated', 1)`,
			)
			.run();

		let caught: unknown;
		try {
			await db
				.prepare(
					`INSERT INTO missions (external_id, template_id, callsign, seq, title, visibility, created_by)
					 VALUES ('cseqB002', 'rideshare', 'COL-C', 1, 'second', 'authenticated', 1)`,
				)
				.run();
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(Error);
		expect(isExternalIdCollision(caught)).toBe(false);
	});
});
