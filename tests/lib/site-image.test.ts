import { describe, it, expect } from "vitest";
import { resolveSiteImageUrl } from "../../src/lib/site-image";
import type { SiteRow } from "../../src/types";

const base: SiteRow = {
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
	created_by: 1,
	created_at: "",
	updated_at: "2026-04-22T00:00:00Z",
};

describe("resolveSiteImageUrl", () => {
	it("returns stored URL for image_source='url'", () => {
		expect(
			resolveSiteImageUrl(
				{ ...base, image_source: "url", image_url: "https://e.example/a.jpg" },
				{ googleEnabled: false },
			),
		).toBe("https://e.example/a.jpg");
	});

	it("returns Worker-proxied route for image_source='upload' with image_key", () => {
		expect(
			resolveSiteImageUrl(
				{
					...base,
					slug: "up",
					image_source: "upload",
					image_key: "sites/1/abc.png",
					updated_at: "2026-04-22T01:00:00Z",
				},
				{ googleEnabled: true },
			),
		).toBe("/sites/up/image?v=2026-04-22T01%3A00%3A00Z");
	});

	it("returns null for image_source='upload' when image_key is missing", () => {
		expect(
			resolveSiteImageUrl(
				{ ...base, image_source: "upload", image_key: null },
				{ googleEnabled: true },
			),
		).toBe(null);
	});

	it("returns /sites/:slug/photo?v=<updated_at> for google_places when enabled", () => {
		// Cache-buster prevents edge-cached bytes from outliving a
		// visibility flip or photo_name change.
		expect(
			resolveSiteImageUrl(
				{
					...base,
					slug: "zeyo",
					image_source: "google_places",
					updated_at: "2026-04-22T01:00:00Z",
				},
				{ googleEnabled: true },
			),
		).toBe("/sites/zeyo/photo?v=2026-04-22T01%3A00%3A00Z");
	});

	it("returns null for google_places when API key missing", () => {
		// This is the critical sloppy-behavior guard: without the key, the
		// page must NOT emit a URL that the Worker can't fulfill.
		expect(
			resolveSiteImageUrl(
				{ ...base, slug: "zeyo", image_source: "google_places" },
				{ googleEnabled: false },
			),
		).toBe(null);
	});

	it("returns null when image_source is null", () => {
		expect(resolveSiteImageUrl(base, { googleEnabled: true })).toBe(null);
	});
});
