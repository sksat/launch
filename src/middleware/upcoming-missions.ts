import { createMiddleware } from "hono/factory";
import { listMissions } from "../db/missions";
import { parseJstAware } from "../lib/datetime";
import { pickHeroImage } from "../lib/hero-image";
import type { AppEnv, MissionRow, UpcomingMissionEntry } from "../types";
import { getSiteIfVisible } from "./visibility";

const HEADER_FEATURED_LIMIT = 3;

function isUpcoming(m: MissionRow): boolean {
	return !["completed", "scrubbed"].includes(m.status);
}

/**
 * Loads the next few upcoming missions (with thumbnails) into c.var so
 * Header's mega menu can render its "Upcoming Missions" widget on every
 * page (section heading + cards with site thumbnails + "All …" CTA).
 *
 * Failures degrade silently to an empty list — the menu stays usable.
 */
export const upcomingMissionsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	try {
		const userId = c.var.user?.id ?? null;
		const missions = await listMissions(c.env.DB, userId, { limit: 20 });
		const upcoming = missions
			.filter(isUpcoming)
			.sort((a, b) => {
				const at = a.scheduled_at
					? parseJstAware(a.scheduled_at).getTime()
					: Number.POSITIVE_INFINITY;
				const bt = b.scheduled_at
					? parseJstAware(b.scheduled_at).getTime()
					: Number.POSITIVE_INFINITY;
				return at - bt;
			})
			.slice(0, HEADER_FEATURED_LIMIT);

		const googleEnabled = !!c.env.GOOGLE_MAPS_API_KEY;
		const entries: UpcomingMissionEntry[] = await Promise.all(
			upcoming.map(async (mission) => {
				const [site, target] = await Promise.all([
					mission.launch_site_id
						? getSiteIfVisible(c, mission.launch_site_id)
						: Promise.resolve(null),
					mission.target_id ? getSiteIfVisible(c, mission.target_id) : Promise.resolve(null),
				]);
				const hero = pickHeroImage(mission, site, target, { googleEnabled });
				return {
					mission,
					thumbnail: { src: hero.src, alt: hero.alt },
				};
			}),
		);
		c.set("upcomingMissions", entries);
	} catch {
		c.set("upcomingMissions", []);
	}
	await next();
});
