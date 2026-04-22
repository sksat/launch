import { describe, it, expect } from "vitest";
import { mockD1 } from "../helpers/mock-d1";
import {
	createFriendRequest,
	acceptFriendRequest,
	declineFriendRequest,
	withdrawFriendRequest,
	removeFriend,
	areFriends,
	acceptedFriendIdsOf,
	listAcceptedFriends,
	listIncomingRequests,
	listOutgoingRequests,
	getFriendshipBetween,
} from "../../src/db/friendships";

describe("friendships db", () => {
	describe("createFriendRequest", () => {
		it("inserts pending row with requester and addressee", async () => {
			const { db, calls } = mockD1();

			await createFriendRequest(db, 7, 42);

			const insert = calls.find((c) => /INSERT INTO friendships/.test(c.sql));
			expect(insert).toBeTruthy();
			expect(insert!.sql).toContain("'pending'");
			expect(insert!.sql).toMatch(/ON CONFLICT.*DO NOTHING/);
			expect(insert!.bound).toEqual([7, 42]);
		});

		it("rejects self-request", async () => {
			const { db } = mockD1();
			await expect(createFriendRequest(db, 7, 7)).rejects.toThrow(/self/i);
		});
	});

	describe("acceptFriendRequest", () => {
		it("updates status to accepted only when matching pending row exists", async () => {
			const { db, calls } = mockD1();

			await acceptFriendRequest(db, /* requesterId */ 7, /* addresseeId */ 42);

			const update = calls.find((c) => /UPDATE friendships SET/.test(c.sql));
			expect(update).toBeTruthy();
			expect(update!.sql).toContain("status = 'accepted'");
			expect(update!.sql).toContain("responded_at = datetime('now')");
			expect(update!.sql).toContain("status = 'pending'");
			// requester_id, addressee_id
			expect(update!.bound).toEqual([7, 42]);
		});
	});

	describe("declineFriendRequest", () => {
		it("deletes pending row", async () => {
			const { db, calls } = mockD1();

			await declineFriendRequest(db, 7, 42);

			const del = calls.find((c) => /DELETE FROM friendships/.test(c.sql));
			expect(del).toBeTruthy();
			expect(del!.sql).toContain("status = 'pending'");
			expect(del!.bound).toEqual([7, 42]);
		});
	});

	describe("withdrawFriendRequest", () => {
		it("deletes own pending row", async () => {
			const { db, calls } = mockD1();

			await withdrawFriendRequest(db, /* requesterId */ 7, /* addresseeId */ 42);

			const del = calls.find((c) => /DELETE FROM friendships/.test(c.sql));
			expect(del).toBeTruthy();
			expect(del!.sql).toContain("status = 'pending'");
			expect(del!.bound).toEqual([7, 42]);
		});
	});

	describe("removeFriend", () => {
		it("deletes the accepted row in either direction", async () => {
			const { db, calls } = mockD1();

			await removeFriend(db, 7, 42);

			const del = calls.find((c) => /DELETE FROM friendships/.test(c.sql));
			expect(del).toBeTruthy();
			expect(del!.sql).toContain("status = 'accepted'");
			// matches either (7,42) or (42,7)
			expect(del!.bound).toEqual([7, 42, 42, 7]);
		});
	});

	describe("areFriends", () => {
		it("returns true when an accepted row exists in either direction", async () => {
			const { db, respond } = mockD1();
			respond(/SELECT 1 FROM friendships/, { first: { 1: 1 } });

			expect(await areFriends(db, 7, 42)).toBe(true);
		});

		it("returns false when no accepted row", async () => {
			const { db, respond } = mockD1();
			respond(/SELECT 1 FROM friendships/, { first: null });

			expect(await areFriends(db, 7, 42)).toBe(false);
		});

		it("checks both directions", async () => {
			const { db, calls, respond } = mockD1();
			respond(/SELECT 1 FROM friendships/, { first: null });

			await areFriends(db, 7, 42);

			const sel = calls.find((c) => /SELECT 1 FROM friendships/.test(c.sql));
			expect(sel!.sql).toContain("status = 'accepted'");
			expect(sel!.bound).toEqual([7, 42, 42, 7]);
		});
	});

	describe("acceptedFriendIdsOf", () => {
		it("returns the other party's user ids regardless of direction", async () => {
			const { db, calls, respond } = mockD1();
			respond(/FROM friendships/, {
				results: [{ friend_id: 11 }, { friend_id: 22 }],
			});

			const ids = await acceptedFriendIdsOf(db, 7);

			expect(ids).toEqual([11, 22]);
			const sel = calls.find((c) => /FROM friendships/.test(c.sql));
			expect(sel!.sql).toContain("status = 'accepted'");
			// userId binds: CASE comparison + each side of OR
			expect(sel!.bound).toEqual([7, 7, 7]);
		});
	});

	describe("listAcceptedFriends", () => {
		it("joins users and returns avatar/login", async () => {
			const { db, calls, respond } = mockD1();
			respond(/FROM friendships/, {
				results: [{ id: 11, login: "pepepper", display_name: "pepepper", avatar_url: "x" }],
			});

			const friends = await listAcceptedFriends(db, 7);

			expect(friends).toHaveLength(1);
			const sel = calls.find((c) => /FROM friendships/.test(c.sql));
			expect(sel!.sql).toContain("JOIN users");
			expect(sel!.sql).toContain("status = 'accepted'");
			expect(sel!.bound).toEqual([7, 7, 7]);
		});
	});

	describe("listIncomingRequests", () => {
		it("returns pending where the user is addressee", async () => {
			const { db, calls, respond } = mockD1();
			respond(/FROM friendships/, { results: [] });

			await listIncomingRequests(db, 7);

			const sel = calls.find((c) => /FROM friendships/.test(c.sql));
			expect(sel!.sql).toContain("addressee_id = ?");
			expect(sel!.sql).toContain("status = 'pending'");
			expect(sel!.bound).toEqual([7]);
		});
	});

	describe("listOutgoingRequests", () => {
		it("returns pending where the user is requester", async () => {
			const { db, calls, respond } = mockD1();
			respond(/FROM friendships/, { results: [] });

			await listOutgoingRequests(db, 7);

			const sel = calls.find((c) => /FROM friendships/.test(c.sql));
			expect(sel!.sql).toContain("requester_id = ?");
			expect(sel!.sql).toContain("status = 'pending'");
			expect(sel!.bound).toEqual([7]);
		});
	});

	describe("getFriendshipBetween", () => {
		it("matches either direction and returns the row including status", async () => {
			const { db, calls, respond } = mockD1();
			respond(/FROM friendships/, {
				first: { requester_id: 7, addressee_id: 42, status: "pending" },
			});

			const fr = await getFriendshipBetween(db, 7, 42);

			expect(fr).toEqual({ requester_id: 7, addressee_id: 42, status: "pending" });
			const sel = calls.find((c) => /FROM friendships/.test(c.sql));
			expect(sel!.bound).toEqual([7, 42, 42, 7]);
		});
	});
});
