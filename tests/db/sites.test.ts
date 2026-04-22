import { describe, it, expect } from "vitest";
import { mockD1 } from "../helpers/mock-d1";
import {
	createSite,
	getSiteBySlug,
	listSites,
	updateSite,
	deleteSite,
	upsertDefaultSite,
} from "../../src/db/sites";

describe("sites db", () => {
	describe("createSite", () => {
		it("inserts with image_source = url when image_url given", async () => {
			const { db, calls, respond } = mockD1();
			respond(/INSERT INTO sites/, {
				first: { id: 42, slug: "my-site" },
			});

			await createSite(db, {
				slug: "my-site",
				name: "My Site",
				description: "",
				visibility: "authenticated",
				image_source: "url",
				image_url: "https://example.com/a.jpg",
				image_key: null,
				google_place_id: null,
				google_photo_name: null,
				google_attribution: null,
				latitude: null,
				longitude: null,
				address: null,
				created_by: 7,
			});

			const insert = calls.find((c) => /INSERT INTO sites/.test(c.sql));
			expect(insert).toBeTruthy();
			expect(insert!.bound).toEqual([
				"my-site",
				"My Site",
				"",
				"authenticated",
				"url",
				"https://example.com/a.jpg",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				7,
			]);
		});
	});

	describe("getSiteBySlug", () => {
		it("selects by slug", async () => {
			const { db, calls, respond } = mockD1();
			respond(/SELECT .* FROM sites WHERE slug/, {
				first: { id: 1, slug: "zeyo" },
			});

			const result = await getSiteBySlug(db, "zeyo");

			const select = calls.find((c) => /WHERE slug/.test(c.sql));
			expect(select!.bound).toEqual(["zeyo"]);
			expect(result).toEqual({ id: 1, slug: "zeyo" });
		});
	});

	describe("listSites", () => {
		it("includes public only when userId is null", async () => {
			const { db, calls, respond } = mockD1();
			respond(/SELECT .* FROM sites/, { results: [] });

			await listSites(db, null);

			const select = calls.find((c) => /FROM sites/.test(c.sql));
			expect(select!.sql).toContain("visibility = 'public'");
			expect(select!.sql).not.toContain("authenticated");
		});

		it("includes public + authenticated + own private when logged in", async () => {
			const { db, calls, respond } = mockD1();
			respond(/SELECT .* FROM sites/, { results: [] });

			await listSites(db, 42);

			const select = calls.find((c) => /FROM sites/.test(c.sql));
			expect(select!.sql).toContain("visibility = 'public'");
			expect(select!.sql).toContain("visibility = 'authenticated'");
			expect(select!.sql).toMatch(/visibility = 'private'.*created_by = \?/s);
			expect(select!.bound).toContain(42);
		});
	});

	describe("updateSite", () => {
		it("rejects updates to default sites", async () => {
			const { db, respond } = mockD1();
			respond(/SELECT .* FROM sites WHERE id/, {
				first: { id: 1, is_default: 1 },
			});

			await expect(
				updateSite(db, 1, { name: "renamed" }),
			).rejects.toThrow(/default/i);
		});

		it("updates only provided fields", async () => {
			const { db, calls, respond } = mockD1();
			respond(/SELECT .* FROM sites WHERE id/, {
				first: { id: 1, is_default: 0 },
			});
			respond(/UPDATE sites SET/, {
				first: { id: 1, name: "new" },
			});

			await updateSite(db, 1, { name: "new", visibility: "public" });

			const update = calls.find((c) => /UPDATE sites SET/.test(c.sql));
			expect(update!.sql).toContain("name = ?");
			expect(update!.sql).toContain("visibility = ?");
			expect(update!.sql).toContain("updated_at = datetime('now')");
			expect(update!.bound).toEqual(["new", "public", 1]);
		});
	});

	describe("deleteSite", () => {
		it("rejects deleting default sites", async () => {
			const { db, respond } = mockD1();
			respond(/SELECT .* FROM sites WHERE id/, {
				first: { id: 1, is_default: 1 },
			});

			await expect(deleteSite(db, 1)).rejects.toThrow(/default/i);
		});

		it("rejects when referenced by missions", async () => {
			const { db, respond } = mockD1();
			respond(/SELECT .* FROM sites WHERE id/, {
				first: { id: 1, is_default: 0 },
			});
			respond(/SELECT COUNT.* FROM missions/, {
				first: { count: 3 },
			});

			await expect(deleteSite(db, 1)).rejects.toThrow(/mission/i);
		});
	});

	describe("upsertDefaultSite", () => {
		it("INSERT OR REPLACE by slug with is_default = 1", async () => {
			const { db, calls, respond } = mockD1();
			respond(/INSERT INTO sites/, { first: { id: 1 } });

			await upsertDefaultSite(db, {
				slug: "tsukuba-bldg-a",
				name: "Tsukuba Building A",
				description: "",
				visibility: "authenticated",
				image_source: "upload",
				image_url: "/img/tsukuba-h2.jpg",
				latitude: 36.0783,
				longitude: 140.0776,
				address: null,
			});

			const insert = calls.find((c) => /INSERT INTO sites/.test(c.sql));
			expect(insert!.sql).toMatch(/ON CONFLICT\(slug\) DO UPDATE/);
			// is_default hardcoded to 1, created_by stays NULL
			expect(insert!.sql).toContain("is_default");
		});
	});
});
