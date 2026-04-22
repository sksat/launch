import { describe, expect, it } from "vitest";
import { Header } from "../../src/views/components/header";
import type {
	MissionRow,
	SessionUser,
	UpcomingMissionEntry,
} from "../../src/types";

// Hono JSX renders to an HtmlEscapedString — convert to a plain string for assertions.
async function render(
	user: SessionUser | null,
	upcomingMissions: UpcomingMissionEntry[] = [],
): Promise<string> {
	const node = Header({ user, upcomingMissions }) as unknown;
	if (node && typeof (node as { toString: () => string }).toString === "function") {
		return String(await (node as Promise<unknown> | unknown));
	}
	return String(node);
}

const sampleMission = (overrides: Partial<MissionRow> = {}): MissionRow => ({
	id: 1,
	external_id: "00000000-0000-4000-8000-000000000001",
	template_id: "rideshare",
	callsign: "T-5",
	seq: 1,
	title: "Tsukuba → Ariake",
	description: "",
	visibility: "authenticated",
	status: "scheduled",
	scheduled_at: "2026-04-20T05:00:00Z",
	launch_site: "Tsukuba — Building A Parking Lot",
	launch_site_id: 1,
	target_orbit: "Ariake",
	target_id: null,
	vehicle: null,
	created_by: 1,
	created_at: "",
	updated_at: "",
	...overrides,
});

const sampleEntry = (
	mission: Partial<MissionRow> = {},
	thumbnail: { src: string; alt: string } | null = {
		src: "/img/tsukuba-h2.jpg",
		alt: "Tsukuba H-II",
	},
): UpcomingMissionEntry => ({
	mission: sampleMission(mission),
	thumbnail,
});

describe("Header — top bar", () => {
	it("contains the launch.sksat.dev logo", async () => {
		const html = await render(null);
		expect(html).toContain("launch");
		expect(html).toContain(".sksat.dev");
		expect(html).toMatch(/href="\/"/);
	});

	it("renders a menu toggle button with a descriptive aria label", async () => {
		const html = await render(null);
		expect(html).toMatch(
			/aria-label="Open and close navigation menu"/,
		);
		expect(html).toMatch(/aria-expanded="false"/);
		expect(html).toMatch(/id="menu-toggle"/);
	});

	it("does NOT show Missions/Sites/auth links inside the visible top bar", async () => {
		// Missions/Sites/auth should only live inside #mega-menu, not in the
		// always-visible top bar. We verify by ensuring those hrefs appear
		// AFTER the #mega-menu marker in source order.
		const html = await render(null);
		const megaIdx = html.indexOf('id="mega-menu"');
		expect(megaIdx).toBeGreaterThan(-1);

		const missionsIdx = html.indexOf('href="/missions"');
		const sitesIdx = html.indexOf('href="/sites"');
		const loginIdx = html.indexOf('href="/auth/login"');
		expect(missionsIdx).toBeGreaterThan(megaIdx);
		expect(sitesIdx).toBeGreaterThan(megaIdx);
		expect(loginIdx).toBeGreaterThan(megaIdx);
	});
});

describe("Header — mega menu (unauthenticated)", () => {
	it("renders Sign In and not Logout", async () => {
		const html = await render(null);
		expect(html).toContain('href="/auth/login"');
		expect(html).not.toContain('action="/auth/logout"');
	});

	it("contains Missions and Sites navigation links", async () => {
		const html = await render(null);
		expect(html).toContain('href="/missions"');
		expect(html).toContain('href="/sites"');
	});

	it("renders the menu as a single vertical nav (no column eyebrow headers)", async () => {
		// Mobile menu is a full-screen vertical takeover, not a multi-column grid.
		// We deliberately do NOT use Navigation/Account column headers anymore.
		const html = await render(null);
		expect(html).toMatch(/aria-label="Site navigation"/);
		expect(html).not.toMatch(/class="eyebrow[^"]*">Navigation</);
		expect(html).not.toMatch(/class="eyebrow[^"]*">Account</);
	});
});

describe("Header — mega menu (authenticated)", () => {
	const user: SessionUser = { id: 1, login: "sksat" };

	it("shows username and Logout, not Sign In", async () => {
		const html = await render(user);
		expect(html).toContain("sksat");
		expect(html).toContain('action="/auth/logout"');
		expect(html).not.toContain('href="/auth/login"');
	});

	it("still renders Missions and Sites links", async () => {
		const html = await render(user);
		expect(html).toContain('href="/missions"');
		expect(html).toContain('href="/sites"');
	});
});

describe("Header — upcoming missions widget", () => {
	it("hides the widget when no upcoming missions are passed", async () => {
		const html = await render(null, []);
		// The "Upcoming Missions" section heading and All-link should NOT render.
		expect(html).not.toMatch(/>Upcoming Missions</);
		expect(html).not.toMatch(/All Upcoming Missions/);
	});

	it("renders heading + per-mission cards + 'all' link when entries are present", async () => {
		const entries: UpcomingMissionEntry[] = [
			sampleEntry({ id: 7, external_id: "ext-7", callsign: "T-5" }),
			sampleEntry({ id: 8, external_id: "ext-8", callsign: "L-12", title: "Lunch run" }),
		];
		const html = await render(null, entries);
		expect(html).toMatch(/>Upcoming Missions</);
		// Each mission rendered as a clickable card linking to its detail page
		// via its opaque external_id (not the integer PK).
		expect(html).toContain('href="/missions/ext-7"');
		expect(html).toContain('href="/missions/ext-8"');
		expect(html).toContain("T-5");
		expect(html).toContain("L-12");
		// JST date appears under each card.
		expect(html).toMatch(/JST/);
		// Footer "All Upcoming Missions →" CTA pointing to the full list.
		expect(html).toMatch(/All Upcoming Missions/);
	});

	it("renders thumbnail image when provided", async () => {
		const entries = [sampleEntry({ id: 11 }, { src: "/img/x.jpg", alt: "X site" })];
		const html = await render(null, entries);
		// 64x64 rounded card thumbnail per upcoming-mission-card spec.
		expect(html).toMatch(/<img[^>]*src="\/img\/x\.jpg"[^>]*width="64"[^>]*height="64"/);
		expect(html).toMatch(/alt="X site"/);
	});

	it("falls back to a placeholder block when thumbnail is null", async () => {
		const entries = [sampleEntry({ id: 12, external_id: "ext-12" }, null)];
		const html = await render(null, entries);
		// Card still renders with a placeholder div in place of the img.
		expect(html).toContain('href="/missions/ext-12"');
		expect(html).not.toMatch(/<img[^>]*src="[^"]*"[^>]*alt=""/);
	});

	it("appends sequence number when seq > 1", async () => {
		const html = await render(null, [sampleEntry({ id: 9, callsign: "T-5", seq: 4 })]);
		expect(html).toContain("T-5 #4");
	});
});

describe("Header — initial state", () => {
	it("mega menu starts closed (aria-hidden=true)", async () => {
		const html = await render(null);
		expect(html).toMatch(/id="mega-menu"[^>]*aria-hidden="true"/);
	});
});
