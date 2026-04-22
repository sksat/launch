import type { ParticipantRow } from "../types";

export type ParticipantWithUser = ParticipantRow & {
	login: string;
	display_name: string;
	avatar_url: string;
};

export async function boardMission(
	db: D1Database,
	missionId: number,
	userId: number,
	role: "commander" | "crew" = "crew",
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO mission_participants (mission_id, user_id, role)
			 VALUES (?, ?, ?)
			 ON CONFLICT (mission_id, user_id) DO NOTHING`,
		)
		.bind(missionId, userId, role)
		.run();
}

export async function abortMission(
	db: D1Database,
	missionId: number,
	userId: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM mission_participants WHERE mission_id = ? AND user_id = ?")
		.bind(missionId, userId)
		.run();
}

export async function getCrewForMission(
	db: D1Database,
	missionId: number,
): Promise<ParticipantWithUser[]> {
	const { results } = await db
		.prepare(
			`SELECT mp.*, u.login, u.display_name, u.avatar_url
			 FROM mission_participants mp
			 JOIN users u ON u.id = mp.user_id
			 WHERE mp.mission_id = ?
			 ORDER BY
				CASE mp.role WHEN 'commander' THEN 0 ELSE 1 END,
				mp.boarded_at ASC`,
		)
		.bind(missionId)
		.all();
	return results as unknown as ParticipantWithUser[];
}

export async function isParticipant(
	db: D1Database,
	missionId: number,
	userId: number,
): Promise<boolean> {
	const row = await db
		.prepare("SELECT 1 FROM mission_participants WHERE mission_id = ? AND user_id = ?")
		.bind(missionId, userId)
		.first();
	return row !== null;
}

export async function getCrewCount(db: D1Database, missionId: number): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) as count FROM mission_participants WHERE mission_id = ?")
		.bind(missionId)
		.first<{ count: number }>();
	return row?.count ?? 0;
}
