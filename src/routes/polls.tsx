import { Hono } from "hono";
import { getMissionByExternalId } from "../db/missions";
import { isParticipant } from "../db/participants";
import {
	confirmSchedule,
	createPoll,
	getPollForMission,
	getPollOptionForMission,
	vote,
} from "../db/polls";
import { jstHourOf, jstIsoFromFormInput } from "../lib/datetime";
import { generateCallsign, getTemplate } from "../lib/templates";
import { requireAuth } from "../middleware/auth";
import { checkVisibility } from "../middleware/visibility";
import type { AppEnv } from "../types";

export const pollRoutes = new Hono<AppEnv>();

// Create poll for a mission
pollRoutes.post("/:mid/poll", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	if (mission.created_by !== c.var.user?.id) return c.text("Forbidden", 403);
	// The UI only exposes "Create Schedule Poll" while planning. Enforce
	// server-side too — otherwise a direct POST could reopen scheduling
	// on a locked-in or archived mission.
	if (mission.status !== "planning") {
		return c.text("Polls can only be created while the mission is in planning", 409);
	}

	// Reject duplicate creation (e.g. form re-submit after a slow response).
	// `getPollForMission` surfaces only one poll per mission, so a second
	// row would silently orphan the first along with its votes.
	const existingPoll = await getPollForMission(c.env.DB, mission.id);
	if (existingPoll) return c.text("A poll already exists for this mission", 409);

	// `all: true` preserves repeated field names (starts_at[], ends_at[])
	// as arrays; without it, only the last value of each key survives.
	const body = await c.req.parseBody({ all: true });
	const title = (body.poll_title as string) || "Launch Window Poll";
	const closesAt = jstIsoFromFormInput(body.closes_at as string | undefined);

	// Parse time options: expect starts_at[] and ends_at[] arrays
	const startsAt = Array.isArray(body["starts_at[]"])
		? (body["starts_at[]"] as string[])
		: [body["starts_at[]"] as string].filter(Boolean);
	const endsAt = Array.isArray(body["ends_at[]"])
		? (body["ends_at[]"] as string[])
		: [body["ends_at[]"] as string].filter(Boolean);

	// Option timestamps come from `<input type="datetime-local">` — interpret
	// them as JST, the UI's sole timezone, before persisting.
	const options = startsAt
		.map((s, i) => ({
			starts_at: jstIsoFromFormInput(s),
			ends_at: jstIsoFromFormInput(endsAt[i] ?? s),
		}))
		.filter((o): o is { starts_at: string; ends_at: string } => !!o.starts_at && !!o.ends_at);

	if (options.length === 0) return c.text("At least one time option required", 400);

	try {
		await createPoll(c.env.DB, {
			mission_id: mission.id,
			title,
			closes_at: closesAt,
			created_by: c.var.user!.id,
			options,
		});
	} catch (err) {
		// Pre-insert existence check above is racy against concurrent POSTs
		// (double-submit / retry-on-slow). Fall back on UNIQUE(mission_id)
		// and surface a clean 409 rather than a raw D1 constraint 500.
		if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
			return c.text("A poll already exists for this mission", 409);
		}
		throw err;
	}

	return c.redirect(`/missions/${mission.external_id}`);
});

// Vote on poll options
pollRoutes.post("/:mid/poll/vote", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();

	const denied = await checkVisibility(c, mission);
	if (denied) return denied;

	// Visibility is not enough for voting — only people actually on the
	// mission (creator or boarded crew) should influence its schedule.
	// Viewers of a public/authenticated/friends mission who aren't on the
	// crew list are intentionally excluded.
	const userId = c.var.user!.id;
	const onCrew = await isParticipant(c.env.DB, mission.id, userId);
	if (!onCrew) {
		return c.text("Only mission participants can vote", 403);
	}

	const poll = await getPollForMission(c.env.DB, mission.id);
	if (!poll || poll.is_closed) return c.text("No open poll", 400);

	const body = await c.req.parseBody();

	// Expect vote_{optionId} = "available" | "maybe" | "unavailable"
	const stmts: Promise<void>[] = [];
	for (const option of poll.options) {
		const key = `vote_${option.id}`;
		const val = body[key] as string | undefined;
		if (val && ["available", "maybe", "unavailable"].includes(val)) {
			stmts.push(
				vote(c.env.DB, option.id, c.var.user!.id, val as "available" | "maybe" | "unavailable"),
			);
		}
	}
	await Promise.all(stmts);

	return c.redirect(`/missions/${mission.external_id}`);
});

// Confirm schedule from poll option
pollRoutes.post("/:mid/poll/confirm", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	if (mission.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	const body = await c.req.parseBody();
	const optionId = Number.parseInt(body.option_id as string, 10);

	// Once confirmed the poll is locked (is_closed=1). Reject repeat
	// confirmations so a commander can't keep shifting the mission's
	// schedule/callsign after the window has been "finalized".
	const poll = await getPollForMission(c.env.DB, mission.id);
	if (!poll) return c.text("No poll for this mission", 400);
	if (poll.is_closed) return c.text("Poll is already closed", 409);

	const option = await getPollOptionForMission(c.env.DB, mission.id, optionId);
	if (!option) {
		return c.text("Option not found or does not belong to this mission", 400);
	}

	// Keep hour-based callsigns in sync with the chosen launch window —
	// see the analogous branch in /missions/:mid/edit.
	const template = getTemplate(mission.template_id);
	let callsignUpdate: { callsign: string; seq: number } | undefined;
	if (template && !template.callsign_pattern.includes("{seq}")) {
		const oldHour = mission.scheduled_at ? jstHourOf(mission.scheduled_at) : null;
		const newHour = jstHourOf(option.starts_at);
		if (oldHour !== newHour) {
			const newCallsign = generateCallsign(template.callsign_pattern, { hour: newHour });
			if (newCallsign !== mission.callsign) {
				const seqRow = await c.env.DB.prepare(
					"SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM missions WHERE callsign = ? AND id != ?",
				)
					.bind(newCallsign, mission.id)
					.first<{ next_seq: number }>();
				callsignUpdate = {
					callsign: newCallsign,
					seq: seqRow?.next_seq ?? 1,
				};
			}
		}
	}

	await confirmSchedule(c.env.DB, mission.id, option, callsignUpdate);
	return c.redirect(`/missions/${mission.external_id}`);
});
