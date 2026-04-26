import { describe, it, expect } from "vitest";
import { buildDefaultOgp, buildMissionOgp, buildSiteOgp } from "../../src/lib/ogp";
import type { MissionRow, SiteRow } from "../../src/types";

const ORIGIN = "https://launch.sksat.dev";

const baseMission: MissionRow = {
	id: 1,
	external_id: "11111111-1111-1111-1111-111111111111",
	template_id: "rideshare",
	callsign: "T-5",
	seq: 1,
	title: "Morning office run",
	description: "",
	visibility: "public",
	status: "scheduled",
	scheduled_at: null,
	launch_site: null,
	launch_site_id: null,
	target_orbit: null,
	target_id: null,
	vehicle: null,
	created_by: 1,
	created_at: "",
	updated_at: "",
};

const baseSite: SiteRow = {
	id: 10,
	slug: "tsukuba-bldg-a",
	name: "Tsukuba — Building A",
	description: "Default office launch pad",
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
	updated_at: "2026-04-01T00:00:00Z",
};

const baseTarget: SiteRow = { ...baseSite, id: 20, slug: "ariake", name: "Ariake" };

describe("buildDefaultOgp", () => {
	it("renders generic site-level OGP with absolute fallback image and given path", () => {
		const og = buildDefaultOgp(ORIGIN, "/missions/abc");
		expect(og.title).toBe("launch.sksat.dev");
		expect(og.type).toBe("website");
		expect(og.url).toBe("https://launch.sksat.dev/missions/abc");
		expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
		expect(og.twitterCard).toBe("summary_large_image");
		expect(og.description.length).toBeGreaterThan(0);
		expect(og.imageAlt.length).toBeGreaterThan(0);
	});

	it("defaults pathname to / when omitted", () => {
		const og = buildDefaultOgp(ORIGIN);
		expect(og.url).toBe("https://launch.sksat.dev/");
	});
});

describe("buildMissionOgp privacy", () => {
	const opts = { origin: ORIGIN, googleEnabled: false, templateName: "Rideshare" };

	it.each(["authenticated", "friends", "participants"] as const)(
		"returns a generic OGP (no leak) for %s missions",
		(visibility) => {
			const mission = { ...baseMission, visibility, title: "SECRET PLAN", description: "do not leak" };
			const og = buildMissionOgp(mission, null, null, opts);
			expect(og.title).toBe("launch.sksat.dev");
			expect(og.title).not.toContain("SECRET");
			expect(og.title).not.toContain("T-5");
			expect(og.description).not.toContain("do not leak");
			expect(og.description).not.toContain("SECRET");
			expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
			expect(og.url).toBe(`https://launch.sksat.dev/missions/${baseMission.external_id}`);
			expect(og.type).toBe("website");
		},
	);

	it("uses the static fallback image (not site URL) when launch_site is non-public", () => {
		const privateSite: SiteRow = {
			...baseSite,
			visibility: "private",
			image_source: "url",
			image_url: "https://leak.example/private.jpg",
		};
		const og = buildMissionOgp({ ...baseMission, visibility: "public" }, privateSite, null, opts);
		expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
		expect(og.image).not.toContain("leak.example");
	});
});

describe("buildMissionOgp public mission", () => {
	const opts = { origin: ORIGIN, googleEnabled: false, templateName: "Rideshare" };

	it("emits article OGP with callsign + title and absolute URL", () => {
		const og = buildMissionOgp(baseMission, null, null, opts);
		expect(og.title).toBe("T-5 Morning office run");
		expect(og.type).toBe("article");
		expect(og.url).toBe("https://launch.sksat.dev/missions/11111111-1111-1111-1111-111111111111");
		expect(og.twitterCard).toBe("summary_large_image");
	});

	it("uses public site image_source='url' as-is (already absolute)", () => {
		const site: SiteRow = {
			...baseSite,
			image_source: "url",
			image_url: "https://cdn.example/site.jpg",
		};
		const og = buildMissionOgp(baseMission, site, null, opts);
		expect(og.image).toBe("https://cdn.example/site.jpg");
		expect(og.imageAlt).toBe(site.name);
	});

	it("absolutizes a relative upload image URL against origin", () => {
		const site: SiteRow = {
			...baseSite,
			image_source: "upload",
			image_key: "sites/10/abc.jpg",
		};
		const og = buildMissionOgp(baseMission, site, null, opts);
		expect(og.image).toMatch(
			/^https:\/\/launch\.sksat\.dev\/sites\/tsukuba-bldg-a\/image\?v=/,
		);
	});

	it("falls back to Tsukuba when site image_url is malformed (no 500 on render)", () => {
		// User-editable, unvalidated at write time. A bad URL must not
		// 500 the page via `new URL(...)`.
		const site: SiteRow = {
			...baseSite,
			image_source: "url",
			image_url: "https://[bad-host]",
		};
		const og = buildMissionOgp(baseMission, site, null, opts);
		expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
		expect(og.imageAlt).toBe("H-II rocket full-size model at Tsukuba Expo Center");
	});

	it("falls back to target image when site is non-public but target is public", () => {
		const privateSite: SiteRow = {
			...baseSite,
			visibility: "authenticated",
			image_source: "url",
			image_url: "https://leak.example/private.jpg",
		};
		const target: SiteRow = {
			...baseTarget,
			image_source: "url",
			image_url: "https://cdn.example/target.jpg",
		};
		const og = buildMissionOgp(baseMission, privateSite, target, opts);
		expect(og.image).toBe("https://cdn.example/target.jpg");
		expect(og.imageAlt).toBe("Ariake");
	});

	it("uses templateName when mission.title is empty", () => {
		const og = buildMissionOgp(
			{ ...baseMission, title: "" },
			null,
			null,
			{ ...opts, templateName: "Rideshare" },
		);
		expect(og.title).toBe("T-5 Rideshare");
	});

	it("synthesizes JST scheduled-at description when mission.description is empty", () => {
		const og = buildMissionOgp(
			{ ...baseMission, description: "", scheduled_at: "2026-04-27T15:00:00Z" },
			null,
			null,
			{ ...opts, templateName: "Rideshare" },
		);
		// 2026-04-27T15:00:00Z = 2026-04-28T00:00 JST
		expect(og.description).toContain("APR 28, 2026");
		expect(og.description).toContain("00:00 JST");
		expect(og.description).toContain("Rideshare");
	});

	it("treats an offset-less stored timestamp as JST wall-clock", () => {
		// E2E seed and legacy D1 rows can store `YYYY-MM-DD HH:MM:SS`
		// without an offset. Without normalization Cloudflare Workers would
		// parse it as UTC and the unfurl would advertise "23:00 JST" for a
		// 14:00 JST launch.
		const og = buildMissionOgp(
			{ ...baseMission, description: "", scheduled_at: "2026-04-28 14:00:00" },
			null,
			null,
			{ ...opts, templateName: "Rideshare" },
		);
		expect(og.description).toContain("APR 28, 2026");
		expect(og.description).toContain("14:00 JST");
	});

	it("respects an explicit +09:00 offset (production form pipeline)", () => {
		const og = buildMissionOgp(
			{ ...baseMission, description: "", scheduled_at: "2026-04-28T14:00:00+09:00" },
			null,
			null,
			{ ...opts, templateName: "Rideshare" },
		);
		expect(og.description).toContain("14:00 JST");
	});

	it("falls back to template name only when description and scheduled_at are missing", () => {
		const og = buildMissionOgp(
			{ ...baseMission, description: "", scheduled_at: null },
			null,
			null,
			{ ...opts, templateName: "Rideshare" },
		);
		expect(og.description.toLowerCase()).toContain("rideshare");
		expect(og.description).not.toContain("JST");
	});

	it("clamps a long description to ~200 chars with ellipsis", () => {
		const long = "a".repeat(500);
		const og = buildMissionOgp(
			{ ...baseMission, description: long },
			null,
			null,
			opts,
		);
		expect(og.description.length).toBeLessThanOrEqual(201);
		expect(og.description.endsWith("…")).toBe(true);
	});

	it("collapses whitespace in description", () => {
		const og = buildMissionOgp(
			{ ...baseMission, description: "line one\n\nline   two\ttabbed" },
			null,
			null,
			opts,
		);
		expect(og.description).toBe("line one line two tabbed");
	});

	it("never includes participants — signature does not accept them", () => {
		// Type-level guarantee. This test just documents intent.
		expect(buildMissionOgp.length).toBe(4);
	});
});

describe("buildSiteOgp", () => {
	const opts = { origin: ORIGIN, googleEnabled: false };

	it.each(["authenticated", "friends", "private"] as const)(
		"returns generic OGP (no leak) for %s sites",
		(visibility) => {
			const site: SiteRow = {
				...baseSite,
				visibility,
				name: "SECRET PLACE",
				description: "do not leak",
				image_source: "url",
				image_url: "https://leak.example/private.jpg",
			};
			const og = buildSiteOgp(site, opts);
			expect(og.title).toBe("launch.sksat.dev");
			expect(og.description).not.toContain("do not leak");
			expect(og.description).not.toContain("SECRET");
			expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
			expect(og.url).toBe(`https://launch.sksat.dev/sites/${site.slug}`);
		},
	);

	it("renders rich OGP for a public site with image_source='url'", () => {
		const site: SiteRow = {
			...baseSite,
			image_source: "url",
			image_url: "https://cdn.example/place.jpg",
		};
		const og = buildSiteOgp(site, opts);
		expect(og.title).toBe(site.name);
		expect(og.type).toBe("article");
		expect(og.image).toBe("https://cdn.example/place.jpg");
		expect(og.description).toContain(site.description);
	});

	it("falls back to Tsukuba image for public site with no image", () => {
		const og = buildSiteOgp({ ...baseSite, image_source: null }, opts);
		expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
	});

	it("absolutizes upload image relative URL", () => {
		const og = buildSiteOgp(
			{ ...baseSite, image_source: "upload", image_key: "sites/10/abc.jpg" },
			opts,
		);
		expect(og.image).toMatch(
			/^https:\/\/launch\.sksat\.dev\/sites\/tsukuba-bldg-a\/image\?v=/,
		);
	});

	it("falls back to Tsukuba when public site has a malformed image_url", () => {
		const og = buildSiteOgp(
			{ ...baseSite, image_source: "url", image_url: "https://[bad]" },
			opts,
		);
		expect(og.image).toBe("https://launch.sksat.dev/img/tsukuba-h2.jpg");
	});

	it("synthesizes description when site.description is empty", () => {
		const og = buildSiteOgp({ ...baseSite, description: "" }, opts);
		expect(og.description.toLowerCase()).toContain("launch.sksat.dev");
		expect(og.description).toContain(baseSite.name);
	});
});
