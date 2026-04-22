import type { FriendshipRow, UserRow } from "../types";

export async function createFriendRequest(
	db: D1Database,
	requesterId: number,
	addresseeId: number,
): Promise<void> {
	if (requesterId === addresseeId) {
		throw new Error("Cannot send a friend request to self");
	}
	await db
		.prepare(
			`INSERT INTO friendships (requester_id, addressee_id, status)
			 VALUES (?, ?, 'pending')
			 ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
		)
		.bind(requesterId, addresseeId)
		.run();
}

export async function acceptFriendRequest(
	db: D1Database,
	requesterId: number,
	addresseeId: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE friendships SET status = 'accepted', responded_at = datetime('now')
			 WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`,
		)
		.bind(requesterId, addresseeId)
		.run();
}

export async function declineFriendRequest(
	db: D1Database,
	requesterId: number,
	addresseeId: number,
): Promise<void> {
	await db
		.prepare(
			`DELETE FROM friendships
			 WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`,
		)
		.bind(requesterId, addresseeId)
		.run();
}

export async function withdrawFriendRequest(
	db: D1Database,
	requesterId: number,
	addresseeId: number,
): Promise<void> {
	await db
		.prepare(
			`DELETE FROM friendships
			 WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`,
		)
		.bind(requesterId, addresseeId)
		.run();
}

export async function removeFriend(
	db: D1Database,
	userId: number,
	friendId: number,
): Promise<void> {
	await db
		.prepare(
			`DELETE FROM friendships
			 WHERE status = 'accepted'
			   AND ((requester_id = ? AND addressee_id = ?)
			     OR (requester_id = ? AND addressee_id = ?))`,
		)
		.bind(userId, friendId, friendId, userId)
		.run();
}

export async function areFriends(db: D1Database, a: number, b: number): Promise<boolean> {
	const row = await db
		.prepare(
			`SELECT 1 FROM friendships
			 WHERE status = 'accepted'
			   AND ((requester_id = ? AND addressee_id = ?)
			     OR (requester_id = ? AND addressee_id = ?))`,
		)
		.bind(a, b, b, a)
		.first();
	return row !== null;
}

export async function acceptedFriendIdsOf(db: D1Database, userId: number): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
			 FROM friendships
			 WHERE status = 'accepted'
			   AND (requester_id = ? OR addressee_id = ?)`,
		)
		.bind(userId, userId, userId)
		.all();
	return (results as unknown as { friend_id: number }[]).map((r) => r.friend_id);
}

export async function listAcceptedFriends(db: D1Database, userId: number): Promise<UserRow[]> {
	const { results } = await db
		.prepare(
			`SELECT u.* FROM friendships f
			 JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
			 WHERE f.status = 'accepted'
			   AND (f.requester_id = ? OR f.addressee_id = ?)
			 ORDER BY u.login ASC`,
		)
		.bind(userId, userId, userId)
		.all();
	return results as unknown as UserRow[];
}

export type PendingRequestWithUser = {
	requester_id: number;
	addressee_id: number;
	created_at: string;
	other_login: string;
	other_display_name: string;
	other_avatar_url: string;
};

export async function listIncomingRequests(
	db: D1Database,
	userId: number,
): Promise<PendingRequestWithUser[]> {
	const { results } = await db
		.prepare(
			`SELECT f.requester_id, f.addressee_id, f.created_at,
			        u.login AS other_login, u.display_name AS other_display_name, u.avatar_url AS other_avatar_url
			 FROM friendships f
			 JOIN users u ON u.id = f.requester_id
			 WHERE f.addressee_id = ? AND f.status = 'pending'
			 ORDER BY f.created_at DESC`,
		)
		.bind(userId)
		.all();
	return results as unknown as PendingRequestWithUser[];
}

export async function listOutgoingRequests(
	db: D1Database,
	userId: number,
): Promise<PendingRequestWithUser[]> {
	const { results } = await db
		.prepare(
			`SELECT f.requester_id, f.addressee_id, f.created_at,
			        u.login AS other_login, u.display_name AS other_display_name, u.avatar_url AS other_avatar_url
			 FROM friendships f
			 JOIN users u ON u.id = f.addressee_id
			 WHERE f.requester_id = ? AND f.status = 'pending'
			 ORDER BY f.created_at DESC`,
		)
		.bind(userId)
		.all();
	return results as unknown as PendingRequestWithUser[];
}

export async function getFriendshipBetween(
	db: D1Database,
	a: number,
	b: number,
): Promise<FriendshipRow | null> {
	return (await db
		.prepare(
			`SELECT * FROM friendships
			 WHERE (requester_id = ? AND addressee_id = ?)
			    OR (requester_id = ? AND addressee_id = ?)`,
		)
		.bind(a, b, b, a)
		.first()) as FriendshipRow | null;
}
