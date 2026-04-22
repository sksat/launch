import { Hono } from "hono";
import {
	acceptFriendRequest,
	createFriendRequest,
	declineFriendRequest,
	getFriendshipBetween,
	listAcceptedFriends,
	listIncomingRequests,
	listOutgoingRequests,
	removeFriend,
	withdrawFriendRequest,
} from "../db/friendships";
import { getUserByLogin } from "../db/users";
import { isAllowedUser } from "../lib/allowed-users";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { FriendsPage } from "../views/pages/friends";

export const friendsRoutes = new Hono<AppEnv>();

friendsRoutes.use("*", requireAuth);

type Flash = { kind: "ok" | "err"; text: string };

function flashFromQuery(c: { req: { query: (k: string) => string | undefined } }): Flash | null {
	const ok = c.req.query("ok");
	if (ok) return { kind: "ok", text: ok };
	const err = c.req.query("err");
	if (err) return { kind: "err", text: err };
	return null;
}

function redirectFlash(path: string, kind: "ok" | "err", text: string): string {
	return `${path}?${kind}=${encodeURIComponent(text)}`;
}

friendsRoutes.get("/", async (c) => {
	const user = c.var.user!;
	const [friends, incoming, outgoing] = await Promise.all([
		listAcceptedFriends(c.env.DB, user.id),
		listIncomingRequests(c.env.DB, user.id),
		listOutgoingRequests(c.env.DB, user.id),
	]);
	return c.render(
		<FriendsPage
			user={user}
			friends={friends}
			incoming={incoming}
			outgoing={outgoing}
			flash={flashFromQuery(c)}
		/>,
	);
});

friendsRoutes.post("/requests", async (c) => {
	const user = c.var.user!;
	const body = await c.req.parseBody();
	const loginRaw = (body.login as string | undefined)?.trim();
	if (!loginRaw) {
		return c.redirect(redirectFlash("/friends", "err", "GitHub login is required"), 303);
	}
	// GitHub logins are case-insensitive; normalize to lowercase so both
	// isAllowedUser() (case-insensitive map) and the case-sensitive users.login
	// lookup agree regardless of what the user typed.
	const login = loginRaw.replace(/^@/, "").toLowerCase();

	if (login === user.login.toLowerCase()) {
		return c.redirect(
			redirectFlash("/friends", "err", "Cannot send a friend request to yourself"),
			303,
		);
	}
	if (!isAllowedUser(login)) {
		return c.redirect(
			redirectFlash("/friends", "err", `${login} is not on the allowed-users list`),
			303,
		);
	}

	const target = await getUserByLogin(c.env.DB, login);
	if (!target) {
		return c.redirect(
			redirectFlash("/friends", "err", `${login} hasn't signed in yet — ask them to log in first`),
			303,
		);
	}

	// If a relationship already exists, surface the current state instead of inserting.
	const existing = await getFriendshipBetween(c.env.DB, user.id, target.id);
	if (existing) {
		if (existing.status === "accepted") {
			return c.redirect(redirectFlash("/friends", "err", `Already friends with ${login}`), 303);
		}
		// pending — if we're the addressee, auto-accept; otherwise it's our own outstanding request.
		if (existing.addressee_id === user.id) {
			await acceptFriendRequest(c.env.DB, existing.requester_id, existing.addressee_id);
			return c.redirect(redirectFlash("/friends", "ok", `Now friends with ${login}`), 303);
		}
		return c.redirect(
			redirectFlash("/friends", "err", `Request to ${login} is already pending`),
			303,
		);
	}

	await createFriendRequest(c.env.DB, user.id, target.id);
	return c.redirect(redirectFlash("/friends", "ok", `Friend request sent to ${login}`), 303);
});

friendsRoutes.post("/requests/:requesterId/accept", async (c) => {
	const user = c.var.user!;
	const requesterId = Number.parseInt(c.req.param("requesterId"), 10);
	if (!Number.isFinite(requesterId)) return c.text("Bad request", 400);
	await acceptFriendRequest(c.env.DB, requesterId, user.id);
	return c.redirect(redirectFlash("/friends", "ok", "Friend request accepted"), 303);
});

friendsRoutes.post("/requests/:requesterId/decline", async (c) => {
	const user = c.var.user!;
	const requesterId = Number.parseInt(c.req.param("requesterId"), 10);
	if (!Number.isFinite(requesterId)) return c.text("Bad request", 400);
	await declineFriendRequest(c.env.DB, requesterId, user.id);
	return c.redirect(redirectFlash("/friends", "ok", "Request declined"), 303);
});

friendsRoutes.post("/requests/:addresseeId/withdraw", async (c) => {
	const user = c.var.user!;
	const addresseeId = Number.parseInt(c.req.param("addresseeId"), 10);
	if (!Number.isFinite(addresseeId)) return c.text("Bad request", 400);
	await withdrawFriendRequest(c.env.DB, user.id, addresseeId);
	return c.redirect(redirectFlash("/friends", "ok", "Request withdrawn"), 303);
});

friendsRoutes.post("/:friendId/remove", async (c) => {
	const user = c.var.user!;
	const friendId = Number.parseInt(c.req.param("friendId"), 10);
	if (!Number.isFinite(friendId)) return c.text("Bad request", 400);
	await removeFriend(c.env.DB, user.id, friendId);
	return c.redirect(redirectFlash("/friends", "ok", "Friend removed"), 303);
});
