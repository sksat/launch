import { Hono } from "hono";
import { acceptedFriendIdsOf } from "../db/friendships";
import { listMissions, listMissionsByCreators } from "../db/missions";
import { getUsersByIds } from "../db/users";
import { getSiteIfVisible } from "../middleware/visibility";
import type { AppEnv, UserRow } from "../types";
import { HomePage } from "../views/pages/home";

export const homeRoutes = new Hono<AppEnv>();

homeRoutes.get("/", async (c) => {
	const user = c.var.user;
	// `limit: 50` keeps the featured-mission lookup reliable even when
	// lots of `go`/`scheduled` rows push a nearer `planning` mission past
	// `limit: 10`'s status-first ordering. For the page's tables we still
	// display a subset below.
	const missions = await listMissions(c.env.DB, user?.id ?? null, { limit: 50 });
	// Pick the same mission HomePage will render in the hero: the next
	// active mission by scheduled_at ascending. Using `.find()` on the
	// status-ordered result here would mismatch the page's sort and pair
	// the wrong hero assets with the displayed featured mission.
	const featured = missions
		.filter((m) => !["completed", "scrubbed"].includes(m.status))
		.sort((a, b) => {
			const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
			const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
			return at - bt;
		})[0];
	const featuredSite = featured?.launch_site_id
		? await getSiteIfVisible(c, featured.launch_site_id)
		: null;
	const featuredTarget = featured?.target_id
		? await getSiteIfVisible(c, featured.target_id)
		: null;

	let friendActivity: { mission: import("../types").MissionRow; creator: UserRow }[] = [];
	if (user) {
		const friendIds = await acceptedFriendIdsOf(c.env.DB, user.id);
		if (friendIds.length > 0) {
			const recent = await listMissionsByCreators(c.env.DB, user.id, friendIds, 5);
			if (recent.length > 0) {
				const creators = await getUsersByIds(
					c.env.DB,
					Array.from(new Set(recent.map((m) => m.created_by))),
				);
				const byId = new Map(creators.map((u) => [u.id, u]));
				friendActivity = recent
					.map((m) => {
						const creator = byId.get(m.created_by);
						return creator ? { mission: m, creator } : null;
					})
					.filter((x): x is { mission: import("../types").MissionRow; creator: UserRow } => !!x);
			}
		}
	}

	return c.render(
		<HomePage
			missions={missions}
			featuredSite={featuredSite}
			featuredTarget={featuredTarget}
			user={user}
			googleEnabled={!!c.env.GOOGLE_MAPS_API_KEY}
			friendActivity={friendActivity}
		/>,
	);
});
