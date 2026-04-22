import { deleteCookie, getSignedCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { isAllowedUser } from "../lib/allowed-users";
import type { AppEnv } from "../types";

/**
 * Global auth middleware: parses the session cookie and sets c.var.user.
 * Runs on every request. Does NOT reject unauthenticated requests —
 * use requireAuth for that.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const session = await getSignedCookie(c, c.env.SESSION_SECRET, "session");
	if (!session) {
		c.set("user", null);
		await next();
		return;
	}
	try {
		const payload = JSON.parse(session) as { u: number; l: string; e: number };
		// Re-check allow-list on every request so removing a user from
		// allowed-users.json is effective immediately instead of waiting
		// for the 7-day session expiry.
		if (payload.e < Math.floor(Date.now() / 1000) || !isAllowedUser(payload.l)) {
			deleteCookie(c, "session", { path: "/", secure: true });
			c.set("user", null);
		} else {
			c.set("user", { id: payload.u, login: payload.l });
		}
	} catch {
		deleteCookie(c, "session", { path: "/", secure: true });
		c.set("user", null);
	}
	await next();
});

/**
 * Same-origin path + search to use as the `redirect` query param after
 * login. `c.req.url` is a full URL; sanitizeRedirect only accepts paths,
 * so we strip the origin here.
 */
function currentPathAndSearch(c: { req: { url: string } }): string {
	const u = new URL(c.req.url);
	return `${u.pathname}${u.search}`;
}

/**
 * Route-level middleware: redirects to login if not authenticated.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.var.user) {
		return c.redirect(`/auth/login?redirect=${encodeURIComponent(currentPathAndSearch(c))}`);
	}
	await next();
});
