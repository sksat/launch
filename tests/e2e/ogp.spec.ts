import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { pepepperId, wranglerExec } from "./helpers/seed";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const PERSIST_TO = process.env.WRANGLER_PERSIST_TO ?? ".wrangler-e2e/state";

const UNIQUE = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type SeededMission = {
	externalId: string;
	callsign: string;
	title: string;
	description: string;
	url: string;
};

async function seedMission(opts: {
	visibility: "public" | "authenticated" | "friends" | "participants";
	createdBy: number;
	launchSiteId?: number | null;
	title?: string;
	description?: string;
}): Promise<SeededMission> {
	const externalId = crypto.randomUUID();
	const callsign = `OGP-${externalId.slice(0, 6).toUpperCase()}`;
	const title = opts.title ?? `Mission Title ${UNIQUE()}`;
	const description = opts.description ?? `Description body ${UNIQUE()}`;
	const launchSiteId = opts.launchSiteId ?? null;

	wranglerExec(
		`INSERT INTO missions
		 (external_id, template_id, callsign, seq, title, description, visibility, scheduled_at, launch_site_id, target_orbit, created_by)
		 VALUES (
		   '${externalId}', 'rideshare', '${callsign}', 1,
		   '${title.replace(/'/g, "''")}',
		   '${description.replace(/'/g, "''")}',
		   '${opts.visibility}',
		   '2026-04-28 14:00:00',
		   ${launchSiteId === null ? "NULL" : launchSiteId},
		   'Test Target',
		   ${opts.createdBy}
		 );`,
	);
	return {
		externalId,
		callsign,
		title,
		description,
		url: `/missions/${externalId}`,
	};
}

async function seedSite(opts: {
	slug: string;
	name: string;
	description: string;
	visibility: "public" | "authenticated" | "friends" | "private";
	createdBy: number;
	imageUrl?: string;
}): Promise<{ slug: string; id: number; name: string; description: string }> {
	const imageSource = opts.imageUrl ? "'url'" : "NULL";
	const imageUrlSql = opts.imageUrl ? `'${opts.imageUrl.replace(/'/g, "''")}'` : "NULL";
	wranglerExec(
		`INSERT INTO sites (slug, name, description, visibility, image_source, image_url, created_by)
		 VALUES (
		   '${opts.slug}',
		   '${opts.name.replace(/'/g, "''")}',
		   '${opts.description.replace(/'/g, "''")}',
		   '${opts.visibility}',
		   ${imageSource},
		   ${imageUrlSql},
		   ${opts.createdBy}
		 ) ON CONFLICT(slug) DO NOTHING;`,
	);
	// Get the id back. wranglerExec doesn't return rows, so we spawn a
	// dedicated lookup matching its --persist-to.
	const idQuery = `SELECT id FROM sites WHERE slug = '${opts.slug}' LIMIT 1`;
	const r = spawnSync(
		"pnpm",
		[
			"wrangler",
			"d1",
			"execute",
			"launch-db",
			"--local",
			"--persist-to",
			PERSIST_TO,
			"--command",
			idQuery,
			"--json",
		],
		{ cwd: REPO_ROOT, stdio: "pipe" },
	);
	const parsed = JSON.parse(r.stdout.toString()) as Array<{ results: Array<{ id: number }> }>;
	const id = parsed[0]?.results[0]?.id;
	if (!id) throw new Error(`failed to fetch site id for ${opts.slug}`);
	return { slug: opts.slug, id, name: opts.name, description: opts.description };
}

// Tests seed `visibility='public'` sites/missions which would otherwise leak
// into later specs that expect anon visitors to see no rows (e.g.
// sites.spec.ts: "authenticated-visibility defaults are hidden from
// unauthenticated users"). Wipe everything we created at the end of the file.
test.afterAll(() => {
	wranglerExec(`
		DELETE FROM missions WHERE callsign LIKE 'OGP-%';
		DELETE FROM sites WHERE slug LIKE 'pub-site-%' OR slug LIKE 'priv-site-%' OR slug LIKE 'pub-detail-%' OR slug LIKE 'priv-detail-%';
	`);
});

function extractMetaRegion(html: string): string {
	const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
	return headMatch ? headMatch[1] : html;
}

function findMeta(html: string, key: string): string | null {
	// matches <meta property="og:title" content="..."> or twitter:.
	const re = new RegExp(
		`<meta\\s+(?:property|name)="${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"\\s+content="([^"]*)"`,
		"i",
	);
	const m = html.match(re);
	return m ? m[1] : null;
}

function findCanonical(html: string): string | null {
	const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
	return m ? m[1] : null;
}

test.describe("OGP — public mission unfurls richly (anonymous)", () => {
	test("public mission with no launch_site uses fallback Tsukuba image and absolute URLs", async ({
		request,
	}) => {
		// Need a user row for created_by FK; pepepperId requires that
		// pepepper has logged in at least once.
		await ensurePepepper();
		const uid = await pepepperId();
		const mission = await seedMission({
			visibility: "public",
			createdBy: uid,
			launchSiteId: null,
			title: "Public Demo Day",
			description: "Cinematic showcase mission for the public.",
		});

		const res = await request.get(mission.url);
		expect(res.status()).toBe(200);
		const html = await res.text();
		const head = extractMetaRegion(html);

		expect(findMeta(head, "og:type")).toBe("article");
		expect(findMeta(head, "og:title")).toContain(mission.callsign);
		expect(findMeta(head, "og:title")).toContain(mission.title);
		expect(findMeta(head, "og:description")).toContain("Cinematic showcase");
		expect(findMeta(head, "og:url")).toMatch(
			new RegExp(`^https?://[^/]+/missions/${mission.externalId}$`),
		);
		expect(findMeta(head, "og:site_name")).toBe("launch.sksat.dev");
		expect(findMeta(head, "twitter:card")).toBe("summary_large_image");
		const ogImage = findMeta(head, "og:image");
		expect(ogImage).toMatch(/^https?:\/\/[^/]+\/img\/tsukuba-h2\.jpg$/);
		expect(findCanonical(head)).toBe(findMeta(head, "og:url"));
	});

	test("public mission with public launch_site uses the site image (absolute URL)", async ({
		request,
	}) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const slug = `pub-site-${UNIQUE()}`;
		const site = await seedSite({
			slug,
			name: "Public Site",
			description: "A publicly visible site",
			visibility: "public",
			createdBy: uid,
			imageUrl: "https://cdn.example/public-site.jpg",
		});
		const mission = await seedMission({
			visibility: "public",
			createdBy: uid,
			launchSiteId: site.id,
		});

		const res = await request.get(mission.url);
		expect(res.status()).toBe(200);
		const head = extractMetaRegion(await res.text());
		expect(findMeta(head, "og:image")).toBe("https://cdn.example/public-site.jpg");
		expect(findMeta(head, "og:image:alt")).toBe("Public Site");
	});

	test("public mission with non-public launch_site falls back to Tsukuba (no leak)", async ({
		request,
	}) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const privateSlug = `priv-site-${UNIQUE()}`;
		const privateName = `Private Place ${UNIQUE()}`;
		const site = await seedSite({
			slug: privateSlug,
			name: privateName,
			description: "Hidden from the world",
			visibility: "private",
			createdBy: uid,
			imageUrl: "https://leak.example/should-not-appear.jpg",
		});
		const mission = await seedMission({
			visibility: "public",
			createdBy: uid,
			launchSiteId: site.id,
			title: "Public Mission Hidden Site",
			description: "Public body",
		});

		const res = await request.get(mission.url);
		expect(res.status()).toBe(200);
		const html = await res.text();
		const head = extractMetaRegion(html);
		expect(findMeta(head, "og:image")).toMatch(/^https?:\/\/[^/]+\/img\/tsukuba-h2\.jpg$/);
		// Critical: the private site's name and image URL must not appear
		// in the OGP meta region of the HTML.
		expect(head).not.toContain("leak.example");
		expect(head).not.toContain(privateName);
		expect(head).not.toContain(privateSlug);
	});
});

test.describe("OGP — non-public missions never leak", () => {
	test("authenticated-only mission served to logged-in viewer carries only generic OGP", async ({
		page,
	}) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const mission = await seedMission({
			visibility: "authenticated",
			createdBy: uid,
			title: `SECRET title ${UNIQUE()}`,
			description: `SECRET description body ${UNIQUE()}`,
		});

		await loginAs(page, "pepepper");
		const res = await page.request.get(mission.url);
		expect(res.status()).toBe(200);
		const html = await res.text();
		const head = extractMetaRegion(html);
		expect(findMeta(head, "og:title")).toBe("launch.sksat.dev");
		expect(findMeta(head, "og:type")).toBe("website");
		expect(findMeta(head, "og:image")).toMatch(/^https?:\/\/[^/]+\/img\/tsukuba-h2\.jpg$/);
		// Hard negative — neither the title nor the description should
		// appear in the OGP head region in any form.
		expect(head).not.toContain(mission.title);
		expect(head).not.toContain(mission.description);
		expect(head).not.toContain(mission.callsign);
		// <title> tag should also be the generic site title.
		const titleTag = html.match(/<title>([^<]*)<\/title>/i)?.[1];
		expect(titleTag).toBe("launch.sksat.dev");
	});

	test("authenticated mission GET while anonymous returns a redirect (no leak in any response body)", async ({
		request,
	}) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const mission = await seedMission({
			visibility: "authenticated",
			createdBy: uid,
			title: `SECRET TITLE ${UNIQUE()}`,
			description: `SECRET DESC ${UNIQUE()}`,
		});

		const res = await request.get(mission.url, { maxRedirects: 0 });
		// Should redirect anonymous users — assert it's a 3xx.
		expect(res.status()).toBeGreaterThanOrEqual(300);
		expect(res.status()).toBeLessThan(400);
		// Even the (effectively empty) redirect body should not contain
		// the mission's title/description.
		const body = await res.text();
		expect(body).not.toContain(mission.title);
		expect(body).not.toContain(mission.description);
		expect(body).not.toContain(mission.callsign);
	});

	test("participants-only mission served to creator carries only generic OGP", async ({
		page,
	}) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const mission = await seedMission({
			visibility: "participants",
			createdBy: uid,
			title: `CREW ONLY ${UNIQUE()}`,
			description: `Don't let it leak ${UNIQUE()}`,
		});

		await loginAs(page, "pepepper");
		const res = await page.request.get(mission.url);
		expect(res.status()).toBe(200);
		const head = extractMetaRegion(await res.text());
		expect(findMeta(head, "og:title")).toBe("launch.sksat.dev");
		expect(head).not.toContain(mission.title);
		expect(head).not.toContain(mission.description);
		expect(head).not.toContain(mission.callsign);
	});
});

test.describe("OGP — site detail", () => {
	test("public site renders rich OGP with absolute image URL", async ({ request }) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const slug = `pub-detail-${UNIQUE()}`;
		const site = await seedSite({
			slug,
			name: `Demo Place ${UNIQUE()}`,
			description: "A visible-to-everyone landmark",
			visibility: "public",
			createdBy: uid,
			imageUrl: "https://cdn.example/demo.jpg",
		});

		const res = await request.get(`/sites/${site.slug}`);
		expect(res.status()).toBe(200);
		const head = extractMetaRegion(await res.text());
		expect(findMeta(head, "og:title")).toBe(site.name);
		expect(findMeta(head, "og:type")).toBe("article");
		expect(findMeta(head, "og:image")).toBe("https://cdn.example/demo.jpg");
		expect(findMeta(head, "og:url")).toMatch(
			new RegExp(`^https?://[^/]+/sites/${site.slug}$`),
		);
	});

	test("private site served to its owner carries only generic OGP", async ({ page }) => {
		await ensurePepepper();
		const uid = await pepepperId();
		const slug = `priv-detail-${UNIQUE()}`;
		const secretName = `Hideout ${UNIQUE()}`;
		const secretDesc = `Top-secret ${UNIQUE()}`;
		await seedSite({
			slug,
			name: secretName,
			description: secretDesc,
			visibility: "private",
			createdBy: uid,
			imageUrl: "https://leak.example/private-site.jpg",
		});

		await loginAs(page, "pepepper");
		const res = await page.request.get(`/sites/${slug}`);
		expect(res.status()).toBe(200);
		const head = extractMetaRegion(await res.text());
		expect(findMeta(head, "og:title")).toBe("launch.sksat.dev");
		expect(head).not.toContain(secretName);
		expect(head).not.toContain(secretDesc);
		expect(head).not.toContain("leak.example");
	});
});

// ---------- helpers ----------

let pepepperEnsured = false;
async function ensurePepepper(): Promise<void> {
	if (pepepperEnsured) return;
	// `pepepperId()` requires the pepepper users row to exist; the
	// global-setup wipes it, so any test that touches D1 directly needs
	// to log pepepper in once first to materialize the row.
	const ctx = await playwrightRequest.newContext({
		baseURL: `http://localhost:${process.env.PORT ?? 5190}`,
	});
	try {
		const r = await ctx.get("/auth/mock-callback?login=pepepper&redirect=/");
		if (!r.ok()) throw new Error(`mock-login failed: ${r.status()}`);
	} finally {
		await ctx.dispose();
	}
	pepepperEnsured = true;
}
