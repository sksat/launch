import { describe, expect, it, vi } from "vitest";
import { createMission } from "../../src/db/missions";

const baseInput = {
	template_id: "rideshare" as const,
	callsign: "T-5",
	title: "test",
	description: "",
	visibility: "authenticated" as const,
	scheduled_at: null,
	launch_site: null,
	launch_site_id: null,
	target_orbit: null,
	target_id: null,
	vehicle: null,
	created_by: 1,
};

// Build a D1 stub that returns `row` for INSERTs after `failures` UNIQUE
// errors. Records every external_id that was bound so tests can verify the
// retry generated a different ID.
function stubDbWithUniqueFailures(opts: {
	failures: number;
	errorMessage?: string;
	finalRow?: object;
}): { db: D1Database; externalIds: string[]; insertCount: () => number } {
	const externalIds: string[] = [];
	let insertCount = 0;
	const errorMessage =
		opts.errorMessage ?? "D1_ERROR: UNIQUE constraint failed: missions.external_id";
	const finalRow = opts.finalRow ?? {
		id: 1,
		external_id: "placeholder",
		callsign: "T-5",
		seq: 1,
	};

	const db = {
		prepare: vi.fn((sql: string) => {
			const isInsert = /INSERT INTO missions/.test(sql);
			let bound: unknown[] = [];
			return {
				bind(...args: unknown[]) {
					bound = args;
					return this;
				},
				async first() {
					if (isInsert) {
						externalIds.push(bound[0] as string);
						insertCount++;
						if (insertCount <= opts.failures) {
							throw new Error(errorMessage);
						}
						return { ...finalRow, external_id: bound[0] };
					}
					return null;
				},
				async run() {
					return { success: true };
				},
				async all() {
					return { results: [], success: true };
				},
			};
		}),
	} as unknown as D1Database;

	return {
		db,
		externalIds,
		insertCount: () => insertCount,
	};
}

describe("createMission — external_id allocation", () => {
	it("returns the row on first INSERT when no collision", async () => {
		const { db, externalIds, insertCount } = stubDbWithUniqueFailures({
			failures: 0,
		});
		const row = await createMission(db, baseInput);
		expect(insertCount()).toBe(1);
		expect(externalIds).toHaveLength(1);
		expect(row.external_id).toMatch(/^[0-9A-Za-z]{8}$/);
	});

	it("retries with a fresh external_id when UNIQUE collision occurs", async () => {
		const { db, externalIds, insertCount } = stubDbWithUniqueFailures({
			failures: 1,
		});
		const row = await createMission(db, baseInput);
		expect(insertCount()).toBe(2);
		expect(externalIds).toHaveLength(2);
		expect(externalIds[0]).not.toBe(externalIds[1]);
		// The successful row should carry the second ID, not the first.
		expect(row.external_id).toBe(externalIds[1]);
	});

	it("throws after exceeding the retry budget", async () => {
		const { db, insertCount } = stubDbWithUniqueFailures({ failures: 99 });
		await expect(createMission(db, baseInput)).rejects.toThrow();
		// 5 attempts max — see MAX_INSERT_RETRIES in src/db/missions.ts.
		expect(insertCount()).toBe(5);
	});

	it("does not retry on a non-external_id UNIQUE violation (e.g., callsign+seq)", async () => {
		// callsign UNIQUE collision is a real logic conflict that another retry
		// can't resolve — generating a new external_id wouldn't help. Surface
		// it immediately.
		const { db, insertCount } = stubDbWithUniqueFailures({
			failures: 99,
			errorMessage: "D1_ERROR: UNIQUE constraint failed: missions.callsign, missions.seq",
		});
		await expect(createMission(db, baseInput)).rejects.toThrow();
		expect(insertCount()).toBe(1);
	});
});
