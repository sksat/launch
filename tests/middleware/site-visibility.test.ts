import { describe, it, expect } from "vitest";
import { canViewSite } from "../../src/middleware/visibility";
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

describe("canViewSite", () => {
	it("allows anyone for public", () => {
		expect(canViewSite({ ...baseSite, visibility: "public" }, null)).toBe(true);
		expect(canViewSite({ ...baseSite, visibility: "public" }, 7)).toBe(true);
	});

	it("requires auth for authenticated", () => {
		const site: SiteRow = { ...baseSite, visibility: "authenticated" };
		expect(canViewSite(site, null)).toBe(false);
		expect(canViewSite(site, 7)).toBe(true);
	});

	it("allows only creator for private", () => {
		const site: SiteRow = { ...baseSite, visibility: "private", created_by: 42 };
		expect(canViewSite(site, null)).toBe(false);
		expect(canViewSite(site, 7)).toBe(false);
		expect(canViewSite(site, 42)).toBe(true);
	});
});
