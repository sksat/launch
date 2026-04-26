import { Hono } from "hono";
import { createSite, deleteSite, getSiteBySlug, listSites, updateSite } from "../db/sites";
import { buildPhotoMediaUrl, findPlaceForSite } from "../lib/google-places";
import { buildSiteOgp } from "../lib/ogp";
import { slugify } from "../lib/slug";
import { requireAuth } from "../middleware/auth";
import { checkSiteVisibility } from "../middleware/visibility";
import type { AppEnv, SiteRow } from "../types";
import { SiteDetailPage } from "../views/pages/site-detail";
import { SiteFormPage } from "../views/pages/site-form";
import { SiteListPage } from "../views/pages/site-list";

export const siteRoutes = new Hono<AppEnv>();

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function parseVisibility(v: unknown): SiteRow["visibility"] {
	if (v === "public" || v === "authenticated" || v === "friends" || v === "private") return v;
	return "authenticated";
}

function parseFloatOrNull(v: unknown): number | null {
	if (typeof v !== "string" || v.trim() === "") return null;
	const n = Number.parseFloat(v);
	return Number.isFinite(n) ? n : null;
}

function extFromContentType(type: string): string | null {
	if (type === "image/jpeg") return "jpg";
	if (type === "image/png") return "png";
	if (type === "image/webp") return "webp";
	return null;
}

/**
 * Cache-Control headers for image responses. We never populate the
 * Cloudflare shared cache — even for currently-public sites — so that
 * later visibility tightening (public → authenticated/friends/private)
 * takes effect immediately instead of being bypassable via cached URLs
 * until the TTL expires. Browsers still get a short per-user cache,
 * shorter for non-public sites.
 */
function imageCacheHeaders(visibility: SiteRow["visibility"]): Record<string, string> {
	const browserMaxAge = visibility === "public" ? 3600 : 300;
	return {
		"Cache-Control": `private, max-age=${browserMaxAge}`,
		"Cloudflare-CDN-Cache-Control": "no-store",
	};
}

function googleEnabled(env: AppEnv["Bindings"]): boolean {
	return !!env.GOOGLE_MAPS_API_KEY;
}

// ---------- List ----------
siteRoutes.get("/", async (c) => {
	const user = c.var.user;
	const sites = await listSites(c.env.DB, user?.id ?? null);
	return c.render(<SiteListPage sites={sites} user={user} googleEnabled={googleEnabled(c.env)} />);
});

// ---------- New site form ----------
siteRoutes.get("/new", requireAuth, (c) => {
	return c.render(<SiteFormPage user={c.var.user!} googleEnabled={googleEnabled(c.env)} />);
});

// ---------- Create site ----------
siteRoutes.post("/", requireAuth, async (c) => {
	const body = await c.req.parseBody();
	const name = (body.name as string)?.trim();
	if (!name) return c.text("Name required", 400);

	// Always normalize user input through slugify so path-reserved chars
	// (`/`, spaces, etc.) can't break routing.
	let slug = slugify((body.slug as string) || name);
	if (!slug) return c.text("Could not derive slug", 400);

	// Ensure slug is unique; if taken, suffix a number
	const existing = await getSiteBySlug(c.env.DB, slug);
	if (existing) {
		let i = 2;
		while (await getSiteBySlug(c.env.DB, `${slug}-${i}`)) i++;
		slug = `${slug}-${i}`;
	}

	const wantsAutoFetch = body.auto_fetch === "on" || body.auto_fetch === "true";
	const imageUrl = (body.image_url as string)?.trim() || null;
	const address = (body.address as string)?.trim() || null;

	let image_source: SiteRow["image_source"] = null;
	let image_url: string | null = null;
	let google_place_id: string | null = null;
	let google_photo_name: string | null = null;
	let google_attribution: string | null = null;

	if (imageUrl) {
		image_source = "url";
		image_url = imageUrl;
	} else if (wantsAutoFetch && c.env.GOOGLE_MAPS_API_KEY) {
		try {
			const result = await findPlaceForSite(
				c.env.GOOGLE_MAPS_API_KEY,
				[name, address].filter(Boolean).join(" "),
				c.env.GOOGLE_PLACES_BASE_URL,
			);
			if (result?.photo_name) {
				image_source = "google_places";
				google_place_id = result.place_id;
				google_photo_name = result.photo_name;
				google_attribution = result.attribution;
			}
		} catch (err) {
			console.error("Google Places lookup failed:", err);
		}
	}

	const site = await createSite(c.env.DB, {
		slug,
		name,
		description: (body.description as string) ?? "",
		visibility: parseVisibility(body.visibility),
		image_source,
		image_url,
		image_key: null,
		google_place_id,
		google_photo_name,
		google_attribution,
		latitude: parseFloatOrNull(body.latitude),
		longitude: parseFloatOrNull(body.longitude),
		address,
		created_by: c.var.user!.id,
	});

	return c.redirect(`/sites/${site.slug}`);
});

// ---------- Detail ----------
siteRoutes.get("/:slug", async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();

	const denied = await checkSiteVisibility(c, site);
	if (denied) return denied;

	const origin = new URL(c.req.url).origin;
	const og = buildSiteOgp(site, { origin, googleEnabled: googleEnabled(c.env) });
	const pageTitle = site.visibility === "public" ? site.name : undefined;

	return c.render(
		<SiteDetailPage site={site} user={c.var.user} googleEnabled={googleEnabled(c.env)} />,
		{ title: pageTitle, og },
	);
});

// ---------- Edit form ----------
siteRoutes.get("/:slug/edit", requireAuth, async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();
	if (site.is_default === 1) return c.text("Default sites are not editable", 403);
	if (site.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	return c.render(
		<SiteFormPage user={c.var.user!} site={site} googleEnabled={googleEnabled(c.env)} />,
	);
});

// ---------- Update ----------
siteRoutes.post("/:slug/edit", requireAuth, async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();
	if (site.is_default === 1) return c.text("Default sites are not editable", 403);
	if (site.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	const body = await c.req.parseBody();
	const imageUrl = (body.image_url as string)?.trim() || null;
	// Same non-empty guard as the create route — an empty name leaves
	// blank headings/options throughout the UI.
	const name = (body.name as string)?.trim();
	if (!name) return c.text("Name required", 400);

	const updates: Parameters<typeof updateSite>[2] = {
		name,
		description: (body.description as string) ?? site.description,
		visibility: parseVisibility(body.visibility),
		address: (body.address as string)?.trim() || null,
		latitude: parseFloatOrNull(body.latitude),
		longitude: parseFloatOrNull(body.longitude),
	};

	// Image URL field is only relevant when the current source is `url`
	// or unset. Don't clobber an upload/google source silently.
	// - Non-empty value → switch to / stay on `url` source
	// - Empty value while current source is `url` → clear the image
	//   (users need a way to remove a previously set URL)
	if (site.image_source === null || site.image_source === "url") {
		if (imageUrl) {
			updates.image_source = "url";
			updates.image_url = imageUrl;
		} else if (site.image_source === "url") {
			updates.image_source = null;
			updates.image_url = null;
		}
	}

	await updateSite(c.env.DB, site.id, updates);
	return c.redirect(`/sites/${site.slug}`);
});

// ---------- Delete ----------
siteRoutes.post("/:slug/delete", requireAuth, async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();
	if (site.is_default === 1) return c.text("Default sites cannot be deleted", 403);
	if (site.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	try {
		await deleteSite(c.env.DB, site.id);
	} catch (err) {
		return c.text((err as Error).message, 409);
	}

	// Best-effort cleanup: remove uploaded image from R2
	if (site.image_source === "upload" && site.image_key) {
		try {
			await c.env.SITE_IMAGES.delete(site.image_key);
		} catch {
			// ignore
		}
	}
	// Also drop any cached Google photo bytes for this site
	await deleteGooglePhotoCache(c.env, site.id);

	return c.redirect("/sites");
});

// ---------- Uploaded image delivery (visibility-gated) ----------
//
// Serves objects from the SITE_IMAGES bucket for sites with
// image_source='upload'. The route runs checkSiteVisibility so the
// image inherits the site's access policy — private/friends uploads
// can't leak via R2 URL sharing because the URL is a Worker route,
// not an R2 custom domain.
siteRoutes.get("/:slug/image", async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();

	const denied = await checkSiteVisibility(c, site);
	if (denied) return denied;

	if (site.image_source !== "upload" || !site.image_key) {
		return c.notFound();
	}

	const obj = await c.env.SITE_IMAGES.get(site.image_key);
	if (!obj) return c.notFound();

	return new Response(obj.body, {
		status: 200,
		headers: {
			"Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
			...imageCacheHeaders(site.visibility),
		},
	});
});

// ---------- Image upload ----------
siteRoutes.post("/:slug/image", requireAuth, async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();
	if (site.is_default === 1) return c.text("Default sites are not editable", 403);
	if (site.created_by !== c.var.user?.id) return c.text("Forbidden", 403);

	const body = await c.req.parseBody();
	const file = body.image;
	if (!(file instanceof File)) return c.text("image file required", 400);
	if (file.size > MAX_UPLOAD_BYTES) {
		return c.text(`File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`, 413);
	}

	const ext = extFromContentType(file.type);
	if (!ext || !ALLOWED_EXT.has(ext)) {
		return c.text("Only jpg/png/webp images are accepted", 415);
	}

	const key = `sites/${site.id}/${crypto.randomUUID()}.${ext}`;
	const buf = await file.arrayBuffer();
	await c.env.SITE_IMAGES.put(key, buf, {
		httpMetadata: { contentType: file.type },
	});

	// Delete previous upload if any
	if (site.image_source === "upload" && site.image_key && site.image_key !== key) {
		try {
			await c.env.SITE_IMAGES.delete(site.image_key);
		} catch {
			// ignore
		}
	}

	await updateSite(c.env.DB, site.id, {
		image_source: "upload",
		image_url: null,
		image_key: key,
	});
	// Uploading a real image obsoletes any cached google photo
	if (site.image_source === "google_places") {
		await deleteGooglePhotoCache(c.env, site.id);
	}

	return c.redirect(`/sites/${site.slug}`);
});

// ---------- Fetch Google photo on demand ----------
siteRoutes.post("/:slug/fetch-google-photo", requireAuth, async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();
	if (site.is_default === 1) return c.text("Default sites are not editable", 403);
	if (site.created_by !== c.var.user?.id) return c.text("Forbidden", 403);
	if (!c.env.GOOGLE_MAPS_API_KEY) return c.text("API key not configured", 503);

	const query = [site.name, site.address].filter(Boolean).join(" ");
	const result = await findPlaceForSite(
		c.env.GOOGLE_MAPS_API_KEY,
		query,
		c.env.GOOGLE_PLACES_BASE_URL,
	);
	if (!result?.photo_name) {
		return c.text("No photo available for this place", 404);
	}

	// Switching away from 'upload' obsoletes the R2 object.
	if (site.image_source === "upload" && site.image_key) {
		try {
			await c.env.SITE_IMAGES.delete(site.image_key);
		} catch {
			// best-effort
		}
	}

	await updateSite(c.env.DB, site.id, {
		image_source: "google_places",
		image_url: null,
		image_key: null,
		google_place_id: result.place_id,
		google_photo_name: result.photo_name,
		google_attribution: result.attribution,
	});

	return c.redirect(`/sites/${site.slug}`);
});

// ---------- Google photo proxy (with R2 cache) ----------
/**
 * Places Photos costs $0.007 per fetch. Sites rarely change photos, so we
 * cache the rendered bytes in R2 under `google-photo-cache/<site.id>.jpg`
 * along with the originating photo_name in customMetadata. A stale photo_name
 * (e.g. after a re-fetch) invalidates the entry. Delete mutates the cache
 * directly (see deleteGooglePhotoCache calls in the delete / upload routes).
 */
function googlePhotoCacheKey(siteId: number): string {
	return `google-photo-cache/${siteId}.jpg`;
}

async function deleteGooglePhotoCache(env: AppEnv["Bindings"], siteId: number): Promise<void> {
	try {
		await env.SITE_IMAGES.delete(googlePhotoCacheKey(siteId));
	} catch {
		// best-effort
	}
}

siteRoutes.get("/:slug/photo", async (c) => {
	const site = await getSiteBySlug(c.env.DB, c.req.param("slug"));
	if (!site) return c.notFound();

	const denied = await checkSiteVisibility(c, site);
	if (denied) return denied;

	if (site.image_source !== "google_places" || !site.google_photo_name) {
		return c.notFound();
	}
	// No API key → treat as if the photo doesn't exist. Don't 503 at the <img>
	// tag because the browser shows a broken-image icon; pages avoid emitting
	// this URL entirely when the key is missing (see resolveSiteImageUrl).
	if (!c.env.GOOGLE_MAPS_API_KEY) {
		return c.notFound();
	}

	const cacheHeaders = imageCacheHeaders(site.visibility);
	const cacheKey = googlePhotoCacheKey(site.id);
	const cached = await c.env.SITE_IMAGES.get(cacheKey);
	if (cached && cached.customMetadata?.photo_name === site.google_photo_name) {
		return new Response(cached.body, {
			status: 200,
			headers: {
				"Content-Type": cached.httpMetadata?.contentType ?? "image/jpeg",
				...cacheHeaders,
				"X-Cache": "HIT",
			},
		});
	}

	const upstream = buildPhotoMediaUrl(
		site.google_photo_name,
		c.env.GOOGLE_MAPS_API_KEY,
		1200,
		c.env.GOOGLE_PLACES_BASE_URL,
	);
	const upstreamRes = await fetch(upstream);
	if (!upstreamRes.ok) return c.text("upstream error", 502);
	const buf = await upstreamRes.arrayBuffer();
	const contentType = upstreamRes.headers.get("Content-Type") ?? "image/jpeg";

	await c.env.SITE_IMAGES.put(cacheKey, buf, {
		httpMetadata: { contentType },
		customMetadata: { photo_name: site.google_photo_name },
	});

	return new Response(buf, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			...cacheHeaders,
			"X-Cache": "MISS",
		},
	});
});
