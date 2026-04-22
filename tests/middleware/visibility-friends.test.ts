import { describe, it, expect } from "vitest";
import { canViewSite, visibilityFilter } from "../../src/middleware/visibility";
import type { SiteRow } from "../../src/types";

const baseSite: SiteRow = {
	id: 1,
	slug: "x",
	name: "X",
	description: "",
	visibility: "public",
	image_source: null,
	image_url: null,
	image_key: null,
	google_place_id: null,
	google_photo_name: null,
	google_attribution: null,
	latitude: null,
	longitude: null,
	address: null,
	is_default: 0,
	created_by: 42,
	created_at: "",
	updated_at: "",
};

describe("canViewSite — friends visibility", () => {
	it("allows the creator", () => {
		const site: SiteRow = { ...baseSite, visibility: "friends", created_by: 42 };
		expect(canViewSite(site, 42, new Set())).toBe(true);
	});

	it("allows friends of the creator", () => {
		const site: SiteRow = { ...baseSite, visibility: "friends", created_by: 42 };
		// viewer 7 has 42 in their friend set
		expect(canViewSite(site, 7, new Set([42]))).toBe(true);
	});

	it("rejects non-friend authenticated users", () => {
		const site: SiteRow = { ...baseSite, visibility: "friends", created_by: 42 };
		expect(canViewSite(site, 99, new Set([1, 2, 3]))).toBe(false);
	});

	it("rejects anonymous viewers", () => {
		const site: SiteRow = { ...baseSite, visibility: "friends", created_by: 42 };
		expect(canViewSite(site, null, new Set())).toBe(false);
	});
});

describe("visibilityFilter — friends visibility", () => {
	it("includes friends EXISTS subquery for logged-in users", () => {
		const { clause, params } = visibilityFilter(7);
		expect(clause).toContain("m.visibility = 'friends'");
		expect(clause).toContain("FROM friendships");
		expect(clause).toContain("status = 'accepted'");
		// userId should appear for: participants creator (1x), participants EXISTS (1x),
		// friends EXISTS x2 sides (2x) → 4 occurrences
		expect(params.filter((p) => p === 7).length).toBeGreaterThanOrEqual(4);
	});

	it("anonymous viewers see only public (no friends)", () => {
		const { clause, params } = visibilityFilter(null);
		expect(clause).not.toContain("friends");
		expect(params).toEqual([]);
	});
});
