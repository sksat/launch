import { visibilityFilter } from "../middleware/visibility";
import type { MissionRow } from "../types";

export async function createMission(
	db: D1Database,
	data: {
		template_id: string;
		callsign: string;
		title: string;
		description: string;
		visibility: MissionRow["visibility"];
		scheduled_at: string | null;
		launch_site: string | null;
		launch_site_id: number | null;
		target_orbit: string | null;
		target_id: number | null;
		vehicle: string | null;
		created_by: number;
	},
): Promise<MissionRow> {
	// Opaque URL id (UUID v4). Kept distinct from the INTEGER PK so URLs
	// don't leak a sequential counter and don't imply callsign is a
	// hierarchical namespace.
	const external_id = crypto.randomUUID();

	// seq is derived as `MAX(seq) + 1` per callsign *inline* with the
	// INSERT so two concurrent creates against the same callsign can't
	// both observe the same max and then race on UNIQUE(callsign, seq).
	// D1 serializes writes, which makes the subquery + insert atomic
	// from the app's perspective.
	const result = await db
		.prepare(
			`INSERT INTO missions (external_id, template_id, callsign, seq, title, description, visibility, scheduled_at, launch_site, launch_site_id, target_orbit, target_id, vehicle, created_by)
			 VALUES (
			   ?, ?, ?,
			   (SELECT COALESCE(MAX(seq), 0) + 1 FROM missions WHERE callsign = ?),
			   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			 )
			 RETURNING *`,
		)
		.bind(
			external_id,
			data.template_id,
			data.callsign,
			data.callsign,
			data.title,
			data.description,
			data.visibility,
			data.scheduled_at,
			data.launch_site,
			data.launch_site_id,
			data.target_orbit,
			data.target_id,
			data.vehicle,
			data.created_by,
		)
		.first();

	return result as unknown as MissionRow;
}

export async function getMission(db: D1Database, id: number): Promise<MissionRow | null> {
	return (await db
		.prepare("SELECT * FROM missions WHERE id = ?")
		.bind(id)
		.first()) as MissionRow | null;
}

/**
 * Look up a mission by its URL-addressable external_id. This is the
 * primary path in route handlers; the INTEGER id is only used once
 * the mission has been resolved.
 */
export async function getMissionByExternalId(
	db: D1Database,
	externalId: string,
): Promise<MissionRow | null> {
	return (await db
		.prepare("SELECT * FROM missions WHERE external_id = ?")
		.bind(externalId)
		.first()) as MissionRow | null;
}

export async function listMissions(
	db: D1Database,
	userId: number | null,
	opts?: { status?: string; template_id?: string; limit?: number; offset?: number },
): Promise<MissionRow[]> {
	const { clause, params } = visibilityFilter(userId);
	const conditions = [clause];
	const bindParams = [...params];

	if (opts?.status) {
		conditions.push("m.status = ?");
		bindParams.push(opts.status);
	}
	if (opts?.template_id) {
		conditions.push("m.template_id = ?");
		bindParams.push(opts.template_id);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const limit = opts?.limit ?? 50;
	const offset = opts?.offset ?? 0;

	const { results } = await db
		.prepare(
			`SELECT m.* FROM missions m ${where}
			 ORDER BY
				CASE m.status
					WHEN 'go' THEN 0
					WHEN 'scheduled' THEN 1
					WHEN 'planning' THEN 2
					WHEN 'completed' THEN 3
					WHEN 'scrubbed' THEN 4
				END,
				m.scheduled_at ASC NULLS LAST,
				m.created_at DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(...bindParams, limit, offset)
		.all();

	return results as unknown as MissionRow[];
}

export async function updateMission(
	db: D1Database,
	id: number,
	data: Partial<
		Pick<
			MissionRow,
			| "title"
			| "description"
			| "visibility"
			| "status"
			| "scheduled_at"
			| "launch_site"
			| "launch_site_id"
			| "target_orbit"
			| "target_id"
			| "vehicle"
			| "callsign"
			| "seq"
		>
	>,
): Promise<MissionRow | null> {
	const sets: string[] = [];
	const params: unknown[] = [];

	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined) {
			sets.push(`${key} = ?`);
			params.push(value);
		}
	}

	if (sets.length === 0) return getMission(db, id);

	sets.push("updated_at = datetime('now')");
	params.push(id);

	return (await db
		.prepare(`UPDATE missions SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
		.bind(...params)
		.first()) as MissionRow | null;
}

/**
 * List missions created by a given set of users, applying the viewer's
 * visibility filter. Used to render "friends' recent activity" sections.
 */
export async function listMissionsByCreators(
	db: D1Database,
	viewerId: number | null,
	creatorIds: number[],
	limit = 5,
): Promise<MissionRow[]> {
	if (creatorIds.length === 0) return [];
	const { clause, params } = visibilityFilter(viewerId);
	const placeholders = creatorIds.map(() => "?").join(",");
	const { results } = await db
		.prepare(
			`SELECT m.* FROM missions m
			 WHERE ${clause}
			   AND m.created_by IN (${placeholders})
			 ORDER BY m.created_at DESC
			 LIMIT ?`,
		)
		.bind(...params, ...creatorIds, limit)
		.all();
	return results as unknown as MissionRow[];
}

export async function scrubMission(db: D1Database, id: number): Promise<void> {
	await db
		.prepare("UPDATE missions SET status = 'scrubbed', updated_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
