import type { MissionRow, SiteRow } from "../types";
import { parseJstAware } from "./datetime";
import { resolveSiteImageUrl } from "./site-image";

const SITE_NAME = "launch.sksat.dev";
const SITE_TAGLINE = "Cinematic mission control for everyday plans.";
const FALLBACK_IMAGE = "/img/tsukuba-h2.jpg";
const FALLBACK_IMAGE_ALT = "H-II rocket full-size model at Tsukuba Expo Center";
const DESC_MAX = 200;

export type OgpData = {
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	url: string;
	type: "website" | "article";
	twitterCard: "summary" | "summary_large_image";
};

function absolutize(url: string, origin: string): string {
	return new URL(url, origin).toString();
}

// Total variant: returns null when `url` is malformed. Used for
// user-editable site image URLs (image_source='url' is unvalidated at
// write time), where a bad value must not 500 the whole detail page —
// the caller falls back to the stock image.
function safeAbsolutize(url: string, origin: string): string | null {
	try {
		return absolutize(url, origin);
	} catch {
		return null;
	}
}

function clampDescription(raw: string): string {
	const collapsed = raw.replace(/\s+/g, " ").trim();
	if (collapsed.length <= DESC_MAX) return collapsed;
	// Trim to DESC_MAX-1 then append the ellipsis (single char), keeping
	// total length ≤ DESC_MAX so unfurl previews don't overflow.
	return `${collapsed.slice(0, DESC_MAX - 1).trimEnd()}…`;
}

// CLAUDE.md mandates "APR 28, 2026 · 14:00 JST" style for date display.
// `parseJstAware` defends against offset-less stored values (seed data,
// legacy rows) so the unfurl never advertises a wrong launch time.
function formatJST(iso: string): string {
	const d = parseJstAware(iso);
	const date = d
		.toLocaleDateString("en-US", {
			month: "short",
			day: "2-digit",
			year: "numeric",
			timeZone: "Asia/Tokyo",
		})
		.toUpperCase();
	const time = d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Tokyo",
	});
	return `${date} · ${time} JST`;
}

export function buildDefaultOgp(origin: string, pathname = "/"): OgpData {
	return {
		title: SITE_NAME,
		description: SITE_TAGLINE,
		image: absolutize(FALLBACK_IMAGE, origin),
		imageAlt: FALLBACK_IMAGE_ALT,
		url: absolutize(pathname, origin),
		type: "website",
		twitterCard: "summary_large_image",
	};
}

function pickPublicHero(
	site: SiteRow | null,
	target: SiteRow | null,
	googleEnabled: boolean,
): { src: string; alt: string } | null {
	for (const candidate of [site, target]) {
		if (!candidate) continue;
		// Strict gate: a non-public site's image route returns 401/403 to
		// anonymous unfurlers, so even mentioning the URL in OGP is useless
		// AND leaks the site's existence/slug. Only public sites qualify.
		if (candidate.visibility !== "public") continue;
		const url = resolveSiteImageUrl(candidate, { googleEnabled });
		if (!url) continue;
		return { src: url, alt: candidate.name };
	}
	return null;
}

export function buildMissionOgp(
	mission: MissionRow,
	site: SiteRow | null,
	target: SiteRow | null,
	opts: { origin: string; googleEnabled: boolean; templateName: string },
): OgpData {
	const path = `/missions/${mission.external_id}`;
	if (mission.visibility !== "public") {
		return buildDefaultOgp(opts.origin, path);
	}

	const titleBody = mission.title.trim() || opts.templateName;
	const title = `${mission.callsign} ${titleBody}`.replace(/\s+/g, " ").trim();

	let description: string;
	if (mission.description.trim().length > 0) {
		description = clampDescription(mission.description);
	} else if (mission.scheduled_at) {
		description = `Scheduled ${formatJST(mission.scheduled_at)} · ${opts.templateName}`;
	} else {
		description = `${opts.templateName} mission on ${SITE_NAME}`;
	}

	const hero = pickPublicHero(site, target, opts.googleEnabled);
	const heroAbs = hero ? safeAbsolutize(hero.src, opts.origin) : null;
	const image = heroAbs ?? absolutize(FALLBACK_IMAGE, opts.origin);
	const imageAlt = heroAbs ? (hero?.alt ?? FALLBACK_IMAGE_ALT) : FALLBACK_IMAGE_ALT;

	return {
		title,
		description,
		image,
		imageAlt,
		url: absolutize(path, opts.origin),
		type: "article",
		twitterCard: "summary_large_image",
	};
}

export function buildSiteOgp(
	site: SiteRow,
	opts: { origin: string; googleEnabled: boolean },
): OgpData {
	const path = `/sites/${site.slug}`;
	if (site.visibility !== "public") {
		return buildDefaultOgp(opts.origin, path);
	}

	const description =
		site.description.trim().length > 0
			? clampDescription(site.description)
			: `${site.name} on ${SITE_NAME}`;

	const url = resolveSiteImageUrl(site, { googleEnabled: opts.googleEnabled });
	const abs = url ? safeAbsolutize(url, opts.origin) : null;
	const image = abs ?? absolutize(FALLBACK_IMAGE, opts.origin);
	const imageAlt = abs ? site.name : FALLBACK_IMAGE_ALT;

	return {
		title: site.name,
		description,
		image,
		imageAlt,
		url: absolutize(path, opts.origin),
		type: "article",
		twitterCard: "summary_large_image",
	};
}
