import type { PollOptionRow, PollRow, VoteRow } from "../types";

export type PollWithOptions = PollRow & {
	options: (PollOptionRow & { votes: VoteRow[] })[];
};

export async function createPoll(
	db: D1Database,
	data: {
		mission_id: number;
		title: string;
		closes_at: string | null;
		created_by: number;
		options: { starts_at: string; ends_at: string }[];
	},
): Promise<PollRow> {
	const poll = (await db
		.prepare(
			`INSERT INTO schedule_polls (mission_id, title, closes_at, created_by)
			 VALUES (?, ?, ?, ?) RETURNING *`,
		)
		.bind(data.mission_id, data.title, data.closes_at, data.created_by)
		.first()) as PollRow;

	const stmts = data.options.map((opt, i) =>
		db
			.prepare(
				`INSERT INTO schedule_poll_options (poll_id, starts_at, ends_at, sort_order)
				 VALUES (?, ?, ?, ?)`,
			)
			.bind(poll.id, opt.starts_at, opt.ends_at, i),
	);

	if (stmts.length > 0) {
		await db.batch(stmts);
	}

	return poll;
}

export async function getPollForMission(
	db: D1Database,
	missionId: number,
): Promise<PollWithOptions | null> {
	const poll = (await db
		.prepare("SELECT * FROM schedule_polls WHERE mission_id = ? ORDER BY created_at DESC LIMIT 1")
		.bind(missionId)
		.first()) as PollRow | null;

	if (!poll) return null;

	const { results: options } = await db
		.prepare("SELECT * FROM schedule_poll_options WHERE poll_id = ? ORDER BY sort_order")
		.bind(poll.id)
		.all();

	const optionIds = (options as unknown as PollOptionRow[]).map((o) => o.id);
	let votes: VoteRow[] = [];
	if (optionIds.length > 0) {
		const placeholders = optionIds.map(() => "?").join(",");
		const { results } = await db
			.prepare(`SELECT * FROM schedule_votes WHERE option_id IN (${placeholders})`)
			.bind(...optionIds)
			.all();
		votes = results as unknown as VoteRow[];
	}

	const optionsWithVotes = (options as unknown as PollOptionRow[]).map((opt) => ({
		...opt,
		votes: votes.filter((v) => v.option_id === opt.id),
	}));

	return { ...poll, options: optionsWithVotes };
}

export async function vote(
	db: D1Database,
	optionId: number,
	userId: number,
	availability: VoteRow["availability"],
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO schedule_votes (option_id, user_id, availability)
			 VALUES (?, ?, ?)
			 ON CONFLICT (option_id, user_id) DO UPDATE SET
				availability = excluded.availability,
				voted_at = datetime('now')`,
		)
		.bind(optionId, userId, availability)
		.run();
}

export async function closePoll(db: D1Database, pollId: number): Promise<void> {
	await db.prepare("UPDATE schedule_polls SET is_closed = 1 WHERE id = ?").bind(pollId).run();
}

export type ConfirmScheduleCallsignUpdate = {
	callsign: string;
	seq: number;
};

/**
 * Look up a poll option, verifying it belongs to this mission.
 * Exposed so the calling route can derive a new callsign (for
 * hour-based templates) from the chosen starts_at before commit.
 */
export async function getPollOptionForMission(
	db: D1Database,
	missionId: number,
	optionId: number,
): Promise<PollOptionRow | null> {
	return (await db
		.prepare(
			`SELECT opt.* FROM schedule_poll_options opt
			 JOIN schedule_polls p ON p.id = opt.poll_id
			 WHERE opt.id = ? AND p.mission_id = ?`,
		)
		.bind(optionId, missionId)
		.first()) as PollOptionRow | null;
}

export async function confirmSchedule(
	db: D1Database,
	missionId: number,
	option: PollOptionRow,
	callsignUpdate?: ConfirmScheduleCallsignUpdate,
): Promise<void> {
	const statements = [
		callsignUpdate
			? db
					.prepare(
						"UPDATE missions SET scheduled_at = ?, status = 'scheduled', callsign = ?, seq = ?, updated_at = datetime('now') WHERE id = ?",
					)
					.bind(option.starts_at, callsignUpdate.callsign, callsignUpdate.seq, missionId)
			: db
					.prepare(
						"UPDATE missions SET scheduled_at = ?, status = 'scheduled', updated_at = datetime('now') WHERE id = ?",
					)
					.bind(option.starts_at, missionId),
		db.prepare("UPDATE schedule_polls SET is_closed = 1 WHERE mission_id = ?").bind(missionId),
	];
	await db.batch(statements);
}
