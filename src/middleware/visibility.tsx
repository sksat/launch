import type { Context } from "hono";
import { acceptedFriendIdsOf, areFriends } from "../db/friendships";
import { getSite } from "../db/sites";
import type { AppEnv, MissionRow, SiteRow } from "../types";

/**
 * Check whether the current user can view a mission.
 * Returns null if access is granted, or a Response to return if denied.
 */
export async function checkVisibility(
	c: Context<AppEnv>,
	mission: MissionRow,
): Promise<Response | null> {
	if (mission.visibility === "public") {
		return null;
	}

	const user = c.var.user;
	if (!user) {
		const u = new URL(c.req.url);
		return c.redirect(`/auth/login?redirect=${encodeURIComponent(u.pathname + u.search)}`);
	}

	if (mission.visibility === "authenticated") {
		return null;
	}

	if (mission.created_by === user.id) {
		return null;
	}

	const db = c.env.DB;

	if (mission.visibility === "friends") {
		if (await areFriends(db, user.id, mission.created_by)) {
			return null;
		}
		return await denied(c, "This mission is restricted to the creator's friends.");
	}

	// participants-only: check if user is creator or participant
	const row = await db
		.prepare("SELECT 1 FROM mission_participants WHERE mission_id = ? AND user_id = ?")
		.bind(mission.id, user.id)
		.first();

	if (row) {
		return null;
	}

	return await denied(c, "This mission is restricted to participants only.");
}

function denied(c: Context<AppEnv>, message: string): Response | Promise<Response> {
	return c.html(
		<div class="min-h-screen flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-space-300 mb-2">ACCESS DENIED</h1>
				<p class="text-space-500">{message}</p>
			</div>
		</div>,
		403,
	);
}

/**
 * Pure predicate for site access. Sites use public / authenticated / friends /
 * private (creator-only). For friends visibility the caller must pre-resolve
 * the viewer's accepted-friend ids and pass them in.
 */
export function canViewSite(
	site: SiteRow,
	userId: number | null,
	friendIds: ReadonlySet<number> = new Set(),
): boolean {
	if (site.visibility === "public") return true;
	if (userId === null) return false;
	if (site.visibility === "authenticated") return true;
	if (site.visibility === "friends") {
		if (site.created_by === null) return false;
		return site.created_by === userId || friendIds.has(site.created_by);
	}
	// private
	return site.created_by === userId;
}

/**
 * Fetch a site and return it only if the current viewer is allowed to see it.
 * Returns null when the site doesn't exist OR the viewer cannot access it —
 * callers should treat "inaccessible" the same as "unset" (e.g. fall back to
 * a placeholder hero image) instead of leaking the site's name/link.
 */
export async function getSiteIfVisible(
	c: Context<AppEnv>,
	siteId: number,
): Promise<SiteRow | null> {
	const site = await getSite(c.env.DB, siteId);
	if (!site) return null;
	const userId = c.var.user?.id ?? null;
	let friendIds: ReadonlySet<number> = new Set();
	if (userId !== null && site.visibility === "friends") {
		friendIds = new Set(await acceptedFriendIdsOf(c.env.DB, userId));
	}
	return canViewSite(site, userId, friendIds) ? site : null;
}

export async function checkSiteVisibility(
	c: Context<AppEnv>,
	site: SiteRow,
): Promise<Response | null> {
	const userId = c.var.user?.id ?? null;

	let friendIds: ReadonlySet<number> = new Set();
	if (userId !== null && site.visibility === "friends") {
		friendIds = new Set(await acceptedFriendIdsOf(c.env.DB, userId));
	}

	if (canViewSite(site, userId, friendIds)) return null;

	if (userId === null) {
		const u = new URL(c.req.url);
		return c.redirect(`/auth/login?redirect=${encodeURIComponent(u.pathname + u.search)}`);
	}
	return c.html(
		<div class="min-h-screen flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-space-300 mb-2">ACCESS DENIED</h1>
				<p class="text-space-500">This site is private.</p>
			</div>
		</div>,
		403,
	);
}

/**
 * Build a WHERE clause fragment for listing missions based on auth state.
 * Assumes the missions table is aliased as `m`.
 */
export function visibilityFilter(userId: number | null): {
	clause: string;
	params: unknown[];
} {
	if (userId === null) {
		return { clause: "m.visibility = 'public'", params: [] };
	}
	return {
		clause: `(
			m.visibility = 'public'
			OR m.visibility = 'authenticated'
			OR (m.visibility = 'participants' AND (
				m.created_by = ?
				OR EXISTS (
					SELECT 1 FROM mission_participants mp
					WHERE mp.mission_id = m.id AND mp.user_id = ?
				)
			))
			OR (m.visibility = 'friends' AND (
				m.created_by = ?
				OR EXISTS (
					SELECT 1 FROM friendships f
					WHERE f.status = 'accepted'
					  AND ((f.requester_id = ? AND f.addressee_id = m.created_by)
					    OR (f.addressee_id = ? AND f.requester_id = m.created_by))
				)
			))
		)`,
		params: [userId, userId, userId, userId, userId],
	};
}

/**
 * WHERE clause fragment for listing sites based on auth state.
 * Assumes the sites table is referenced unaliased (column = `visibility`).
 */
export function siteVisibilityFilter(userId: number | null): {
	clause: string;
	params: unknown[];
} {
	if (userId === null) {
		return { clause: "visibility = 'public'", params: [] };
	}
	return {
		clause: `(
			visibility = 'public'
			OR visibility = 'authenticated'
			OR (visibility = 'private' AND created_by = ?)
			OR (visibility = 'friends' AND (
				created_by = ?
				OR EXISTS (
					SELECT 1 FROM friendships f
					WHERE f.status = 'accepted'
					  AND ((f.requester_id = ? AND f.addressee_id = sites.created_by)
					    OR (f.addressee_id = ? AND f.requester_id = sites.created_by))
				)
			))
		)`,
		params: [userId, userId, userId, userId],
	};
}
