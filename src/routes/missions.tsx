import { Hono } from "hono";
import { acceptedFriendIdsOf, listAcceptedFriends } from "../db/friendships";
import {
	createMission,
	getMissionByExternalId,
	listMissions,
	scrubMission,
	updateMission,
} from "../db/missions";
import { abortMission, boardMission, getCrewForMission, isParticipant } from "../db/participants";
import { getPollForMission } from "../db/polls";
import { listSites } from "../db/sites";
import { jstHourOf, jstIsoFromFormInput } from "../lib/datetime";
import { buildMissionOgp } from "../lib/ogp";
import { generateCallsign, getAllTemplates, getTemplate } from "../lib/templates";
import { requireAuth } from "../middleware/auth";
import { checkVisibility, getSiteIfVisible } from "../middleware/visibility";
import type { AppEnv } from "../types";
import { MissionDetailPage } from "../views/pages/mission-detail";
import { MissionFormPage } from "../views/pages/mission-form";
import { MissionListPage } from "../views/pages/mission-list";

export const missionRoutes = new Hono<AppEnv>();

// List missions
missionRoutes.get("/", async (c) => {
	const user = c.var.user;
	const status = c.req.query("status");
	const template_id = c.req.query("type");
	const missions = await listMissions(c.env.DB, user?.id ?? null, { status, template_id });
	return c.render(<MissionListPage missions={missions} user={user} />);
});

// New mission form
missionRoutes.get("/new", requireAuth, async (c) => {
	const templates = getAllTemplates();
	const [sites, friends] = await Promise.all([
		listSites(c.env.DB, c.var.user!.id),
		listAcceptedFriends(c.env.DB, c.var.user!.id),
	]);
	return c.render(
		<MissionFormPage templates={templates} sites={sites} user={c.var.user!} friends={friends} />,
	);
});

// Create mission
missionRoutes.post("/", requireAuth, async (c) => {
	const body = await c.req.parseBody({ all: true });
	const templateId = body.template_id as string;
	const template = getTemplate(templateId);
	if (!template) return c.text("Invalid template", 400);

	const scheduledAt = jstIsoFromFormInput(body.scheduled_at as string | undefined);

	// For SPEC template, we need a sequential callsign
	let callsign: string;
	if (template.callsign_pattern.includes("{seq}")) {
		// Get next global seq for this template code
		const row = await c.env.DB.prepare(
			"SELECT COALESCE(MAX(CAST(REPLACE(callsign, ?, '') AS INTEGER)), 0) + 1 AS next FROM missions WHERE template_id = ?",
		)
			.bind(`${template.code}-`, templateId)
			.first<{ next: number }>();
		callsign = generateCallsign(template.callsign_pattern, { seq: row?.next ?? 1 });
	} else {
		// Hour-based templates (T-{hour}, L-{hour}, V-{hour}) need a
		// schedule up front — without it we'd persist the literal
		// placeholder `T-{hour}` as the callsign. Plain planning-only
		// missions should use the SPEC template.
		if (!scheduledAt) {
			return c.text(
				"This mission type requires a scheduled time. Fill in 'Launch Window' or use the SPEC template for planning missions.",
				400,
			);
		}
		callsign = generateCallsign(template.callsign_pattern, {
			hour: jstHourOf(scheduledAt),
		});
	}

	const launchSiteIdRaw = body.launch_site_id as string | undefined;
	let launchSiteId: number | null =
		launchSiteIdRaw && launchSiteIdRaw !== "" ? Number.parseInt(launchSiteIdRaw, 10) : null;
	if (launchSiteId !== null && !Number.isFinite(launchSiteId)) launchSiteId = null;
	// launch_site TEXT is a denormalized label shown in list/card views
	// without a per-row visibility check. To avoid leaking private /
	// friends-only site names through those views, we only cache the
	// denorm when the site is `public`. For non-public sites the list
	// renders "—" and the detail view resolves the name through
	// getSiteIfVisible. Free-text entries (no FK) pass through as-is.
	let launchSiteText: string | null =
		launchSiteId === null ? (body.launch_site as string) || null : null;
	if (launchSiteId !== null) {
		const site = await getSiteIfVisible(c, launchSiteId);
		if (!site) {
			// Viewer can't access the referenced site — drop the FK entirely
			// so we don't store a pointer to a site they can't see.
			launchSiteId = null;
			launchSiteText = null;
		} else if (site.visibility === "public") {
			launchSiteText = site.name;
		}
	}

	const targetIdRaw = body.target_id as string | undefined;
	let targetId: number | null =
		targetIdRaw && targetIdRaw !== "" ? Number.parseInt(targetIdRaw, 10) : null;
	if (targetId !== null && !Number.isFinite(targetId)) targetId = null;
	let targetText: string | null = targetId === null ? (body.target_orbit as string) || null : null;
	if (targetId !== null) {
		const target = await getSiteIfVisible(c, targetId);
		if (!target) {
			targetId = null;
			targetText = null;
		} else if (target.visibility === "public") {
			targetText = target.name;
		}
	}

	const mission = await createMission(c.env.DB, {
		template_id: templateId,
		callsign,
		title: (body.title as string) || "",
		description: (body.description as string) || "",
		visibility:
			(body.visibility as "public" | "authenticated" | "friends" | "participants") ||
			template.default_visibility,
		scheduled_at: scheduledAt,
		launch_site: launchSiteText,
		launch_site_id: launchSiteId,
		target_orbit: targetText,
		target_id: targetId,
		vehicle: (body.vehicle as string) || null,
		created_by: c.var.user!.id,
	});

	// Auto-board creator as commander
	await boardMission(c.env.DB, mission.id, c.var.user!.id, template.default_roles.creator);

	// Pre-board selected friends as crew. parseBody({all: true}) returns
	// string[] for repeated checkbox fields, single string otherwise.
	const crewRaw = body.crew_ids;
	const crewList = Array.isArray(crewRaw) ? crewRaw : crewRaw != null ? [crewRaw] : [];
	const crewCandidates = crewList
		.map((s) => Number.parseInt(String(s), 10))
		.filter((n) => Number.isFinite(n) && n !== c.var.user!.id);

	if (crewCandidates.length > 0) {
		const allowedFriendIds = new Set(await acceptedFriendIdsOf(c.env.DB, c.var.user!.id));
		for (const friendId of crewCandidates) {
			if (allowedFriendIds.has(friendId)) {
				await boardMission(c.env.DB, mission.id, friendId, "crew");
			}
		}
	}

	return c.redirect(`/missions/${mission.external_id}`);
});

// Mission detail
missionRoutes.get("/:mid", async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();

	const denied = await checkVisibility(c, mission);
	if (denied) return denied;

	const crew = await getCrewForMission(c.env.DB, mission.id);
	const poll = await getPollForMission(c.env.DB, mission.id);
	const user = c.var.user;
	const aboard = user ? await isParticipant(c.env.DB, mission.id, user.id) : false;
	const site = mission.launch_site_id ? await getSiteIfVisible(c, mission.launch_site_id) : null;
	const target = mission.target_id ? await getSiteIfVisible(c, mission.target_id) : null;

	const template = getTemplate(mission.template_id);
	const templateName = template?.name ?? mission.template_id;
	const origin = new URL(c.req.url).origin;
	const og = buildMissionOgp(mission, site, target, {
		origin,
		googleEnabled: !!c.env.GOOGLE_MAPS_API_KEY,
		templateName,
	});
	// Only feed the page <title> for public missions — non-public titles
	// must not appear in the browser tab either.
	const titleBody = mission.title.trim() || templateName;
	const pageTitle =
		mission.visibility === "public" ? `${mission.callsign} ${titleBody}`.trim() : undefined;

	return c.render(
		<MissionDetailPage
			mission={mission}
			site={site}
			target={target}
			crew={crew}
			poll={poll}
			user={user}
			aboard={aboard}
			googleEnabled={!!c.env.GOOGLE_MAPS_API_KEY}
		/>,
		{ title: pageTitle, og },
	);
});

// Edit mission form
missionRoutes.get("/:mid/edit", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	if (mission.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	const templates = getAllTemplates();
	const sites = await listSites(c.env.DB, c.var.user!.id);
	return c.render(
		<MissionFormPage templates={templates} sites={sites} user={c.var.user!} mission={mission} />,
	);
});

// Update mission
missionRoutes.post("/:mid/edit", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	if (mission.created_by !== c.var.user?.id) return c.text("Forbidden", 403);
	// Archived missions are part of the historical record — the UI hides
	// edit controls; reject direct POSTs too so title/schedule/callsign
	// can't be rewritten after the fact.
	if (["completed", "scrubbed"].includes(mission.status)) {
		return c.text("Cannot edit an archived mission", 409);
	}

	const body = await c.req.parseBody();
	const launchSiteIdRaw = body.launch_site_id as string | undefined;
	let launchSiteId: number | null =
		launchSiteIdRaw && launchSiteIdRaw !== "" ? Number.parseInt(launchSiteIdRaw, 10) : null;
	if (launchSiteId !== null && !Number.isFinite(launchSiteId)) launchSiteId = null;
	// See create route: denorm text only caches public site names; non-
	// public ones render via visibility-checked resolution at view time.
	let launchSiteText: string | null =
		launchSiteId === null ? (body.launch_site as string) || null : null;
	if (launchSiteId !== null) {
		const site = await getSiteIfVisible(c, launchSiteId);
		if (!site) {
			launchSiteId = null;
			launchSiteText = null;
		} else if (site.visibility === "public") {
			launchSiteText = site.name;
		}
	}

	const targetIdRaw = body.target_id as string | undefined;
	let targetId: number | null =
		targetIdRaw && targetIdRaw !== "" ? Number.parseInt(targetIdRaw, 10) : null;
	if (targetId !== null && !Number.isFinite(targetId)) targetId = null;
	let targetText: string | null = targetId === null ? (body.target_orbit as string) || null : null;
	if (targetId !== null) {
		const target = await getSiteIfVisible(c, targetId);
		if (!target) {
			targetId = null;
			targetText = null;
		} else if (target.visibility === "public") {
			targetText = target.name;
		}
	}

	const newScheduledAt = jstIsoFromFormInput(body.scheduled_at as string | undefined);

	// If the template is hour-based (T-{hour}, L-{hour}, V-{hour}) and the
	// schedule moves to a different JST hour, regenerate callsign + seq so
	// the designation stays in sync with the mission's actual time. SPEC
	// callsigns use {seq} and are immutable once assigned.
	const template = getTemplate(mission.template_id);
	let callsignUpdate: { callsign: string; seq: number } | undefined;
	if (template && !template.callsign_pattern.includes("{seq}")) {
		if (!newScheduledAt) {
			return c.text(
				"This mission type requires a scheduled time. Use the SPEC template for planning missions.",
				400,
			);
		}
		const oldHour = mission.scheduled_at ? jstHourOf(mission.scheduled_at) : null;
		const newHour = jstHourOf(newScheduledAt);
		if (oldHour !== newHour) {
			const newCallsign = generateCallsign(template.callsign_pattern, {
				hour: newHour,
			});
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

	await updateMission(c.env.DB, mission.id, {
		title: body.title as string,
		description: body.description as string,
		visibility: body.visibility as "public" | "authenticated" | "friends" | "participants",
		scheduled_at: newScheduledAt,
		launch_site: launchSiteText,
		launch_site_id: launchSiteId,
		target_orbit: targetText,
		target_id: targetId,
		vehicle: (body.vehicle as string) || null,
		...callsignUpdate,
	});

	return c.redirect(`/missions/${mission.external_id}`);
});

// Scrub mission
missionRoutes.post("/:mid/scrub", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	if (mission.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	await scrubMission(c.env.DB, mission.id);
	return c.redirect(`/missions/${mission.external_id}`);
});

// Board mission
missionRoutes.post("/:mid/board", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();

	const denied = await checkVisibility(c, mission);
	if (denied) return denied;

	// The UI hides the board button on archived missions; reject direct
	// POSTs too so the crew manifest for completed/scrubbed missions
	// stays a faithful record.
	if (["completed", "scrubbed"].includes(mission.status)) {
		return c.text("Cannot board an archived mission", 409);
	}

	await boardMission(c.env.DB, mission.id, c.var.user!.id);
	return c.redirect(`/missions/${mission.external_id}`);
});

// Abort (leave) mission
missionRoutes.post("/:mid/abort", requireAuth, async (c) => {
	const mission = await getMissionByExternalId(c.env.DB, c.req.param("mid"));
	if (!mission) return c.notFound();
	// The creator is auto-boarded as commander at creation; letting them
	// remove themselves would leave the mission without a commander and
	// break the poll-vote invariant (participants-only). They should
	// `scrub` the mission instead.
	if (mission.created_by === c.var.user!.id) {
		return c.text("Creator cannot abort their own mission — scrub it instead", 409);
	}
	await abortMission(c.env.DB, mission.id, c.var.user!.id);
	return c.redirect(`/missions/${mission.external_id}`);
});
