import { vi } from "vitest";

export type PreparedCall = { sql: string; bound: unknown[] };

export type MockD1Result = {
	first?: unknown;
	results?: unknown[];
};

/**
 * Build a minimal D1Database stub that captures prepare/bind calls and
 * returns programmable results. Good enough to verify SQL and bound params.
 *
 * Usage:
 *   const { db, calls, respond } = mockD1();
 *   respond(/INSERT INTO launch_sites/, { first: { id: 1, ... } });
 *   await createSite(db, ...);
 *   expect(calls[0].bound).toEqual([...]);
 */
export function mockD1() {
	const calls: PreparedCall[] = [];
	const responders: Array<{ matcher: RegExp; result: MockD1Result }> = [];

	const respond = (matcher: RegExp, result: MockD1Result) => {
		responders.push({ matcher, result });
	};

	const resolveResult = (sql: string): MockD1Result => {
		for (const { matcher, result } of responders) {
			if (matcher.test(sql)) return result;
		}
		return {};
	};

	const db = {
		prepare: vi.fn((sql: string) => {
			const statement = {
				_sql: sql,
				_recorded: false,
				record(bound: unknown[]) {
					if (!this._recorded) {
						calls.push({ sql: this._sql, bound });
						this._recorded = true;
					}
				},
				bind(...args: unknown[]) {
					this.record(args);
					return this;
				},
				async first() {
					this.record([]);
					return resolveResult(this._sql).first ?? null;
				},
				async all() {
					this.record([]);
					return { results: resolveResult(this._sql).results ?? [], success: true };
				},
				async run() {
					this.record([]);
					return { success: true };
				},
			};
			return statement;
		}),
	} as unknown as D1Database;

	return { db, calls, respond };
}
