import type { MissionRow, SiteRow } from "../types";
import { resolveSiteImageUrl } from "./site-image";

export type HeroImage = {
	src: string;
	alt: string;
	credit: { author: string; source: string; license: string };
};

const TSUKUBA_H2: HeroImage = {
	src: "/img/tsukuba-h2.jpg",
	alt: "H-II rocket full-size model at Tsukuba Expo Center",
	credit: {
		author: "Motokoka",
		source:
			"https://commons.wikimedia.org/wiki/File:TSUKUBA_EXPO_CENTER_with_H-II_rocket_full%E2%80%90size_model_01.jpg",
		license: "CC BY-SA 4.0",
	},
};

function fromSite(site: SiteRow, googleEnabled: boolean): HeroImage | null {
	const url = resolveSiteImageUrl(site, { googleEnabled });
	if (!url) return null;
	if (site.image_source === "google_places") {
		return {
			src: url,
			alt: site.name,
			credit: {
				author: site.google_attribution ?? "Google",
				source: "https://maps.google.com",
				license: "Google Places Photos",
			},
		};
	}
	return { src: url, alt: site.name, credit: { author: "", source: "", license: "" } };
}

/**
 * Pick a hero image for a mission. Resolution order:
 *   1. Launch site image (if attached and resolvable)
 *   2. Target site image (if attached and resolvable) — Visit missions
 *      deliberately omit the launch site, so the target carries the visual
 *      identity
 *   3. Tsukuba H-II fallback
 */
export function pickHeroImage(
	_mission: Pick<
		MissionRow,
		"launch_site" | "launch_site_id" | "target_orbit" | "target_id" | "template_id" | "id"
	>,
	site?: SiteRow | null,
	target?: SiteRow | null,
	opts: { googleEnabled: boolean } = { googleEnabled: false },
): HeroImage {
	if (site) {
		const fromS = fromSite(site, opts.googleEnabled);
		if (fromS) return fromS;
	}
	if (target) {
		const fromT = fromSite(target, opts.googleEnabled);
		if (fromT) return fromT;
	}
	return TSUKUBA_H2;
}
