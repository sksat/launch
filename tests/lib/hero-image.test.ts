import { describe, it, expect } from "vitest";
import { pickHeroImage } from "../../src/lib/hero-image";
import type { MissionRow, SiteRow } from "../../src/types";

const mission: Pick<
	MissionRow,
	"launch_site" | "launch_site_id" | "target_orbit" | "target_id" | "template_id" | "id"
> = {
	id: 1,
	template_id: "visit",
	launch_site: null,
	launch_site_id: null,
	target_orbit: null,
	target_id: null,
};

const baseSite: SiteRow = {
	id: 10,
	slug: "tsukuba",
	name: "Tsukuba",
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
	is_default: 1,
	created_by: null,
	created_at: "",
	updated_at: "",
};

const baseTarget: SiteRow = { ...baseSite, id: 20, slug: "zeyo", name: "ZEYO" };

describe("pickHeroImage", () => {
	it("falls back to Tsukuba H-II when neither site nor target has an image", () => {
		const hero = pickHeroImage(mission, null, null, { googleEnabled: false });
		expect(hero.src).toBe("/img/tsukuba-h2.jpg");
	});

	it("uses the site image when present (site wins over target)", () => {
		const hero = pickHeroImage(
			mission,
			{ ...baseSite, image_source: "url", image_url: "https://e/site.jpg" },
			{ ...baseTarget, image_source: "url", image_url: "https://e/target.jpg" },
			{ googleEnabled: false },
		);
		expect(hero.src).toBe("https://e/site.jpg");
		expect(hero.alt).toBe("Tsukuba");
	});

	it("falls back to target image when site has no image", () => {
		// The point of this fallback: Visit missions deliberately omit the
		// launch site, so the target IS the visual identity of the mission.
		const hero = pickHeroImage(
			mission,
			null,
			{ ...baseTarget, image_source: "url", image_url: "https://e/zeyo.jpg" },
			{ googleEnabled: false },
		);
		expect(hero.src).toBe("https://e/zeyo.jpg");
		expect(hero.alt).toBe("ZEYO");
	});

	it("uses target's google_places photo when site has none", () => {
		const hero = pickHeroImage(
			mission,
			null,
			{
				...baseTarget,
				image_source: "google_places",
				google_attribution: "Photographer",
			},
			{ googleEnabled: true },
		);
		expect(hero.src).toMatch(/^\/sites\/zeyo\/photo\?v=/);
		expect(hero.credit.author).toBe("Photographer");
	});

	it("falls back to Tsukuba when target's google photo is unavailable (no API key)", () => {
		const hero = pickHeroImage(
			mission,
			null,
			{ ...baseTarget, image_source: "google_places" },
			{ googleEnabled: false },
		);
		expect(hero.src).toBe("/img/tsukuba-h2.jpg");
	});
});
