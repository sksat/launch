import { siteVisibilityFilter } from "../middleware/visibility";
import type { SiteRow } from "../types";

export type CreateSiteInput = {
	slug: string;
	name: string;
	description: string;
	visibility: SiteRow["visibility"];
	image_source: SiteRow["image_source"];
	image_url: string | null;
	image_key: string | null;
	google_place_id: string | null;
	google_photo_name: string | null;
	google_attribution: string | null;
	latitude: number | null;
	longitude: number | null;
	address: string | null;
	created_by: number;
};

export async function createSite(db: D1Database, data: CreateSiteInput): Promise<SiteRow> {
	const result = await db
		.prepare(
			`INSERT INTO sites (
				slug, name, description, visibility,
				image_source, image_url, image_key,
				google_place_id, google_photo_name, google_attribution,
				latitude, longitude, address,
				created_by
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING *`,
		)
		.bind(
			data.slug,
			data.name,
			data.description,
			data.visibility,
			data.image_source,
			data.image_url,
			data.image_key,
			data.google_place_id,
			data.google_photo_name,
			data.google_attribution,
			data.latitude,
			data.longitude,
			data.address,
			data.created_by,
		)
		.first();

	return result as unknown as SiteRow;
}

export async function getSite(db: D1Database, id: number): Promise<SiteRow | null> {
	return (await db.prepare("SELECT * FROM sites WHERE id = ?").bind(id).first()) as SiteRow | null;
}

export async function getSiteBySlug(db: D1Database, slug: string): Promise<SiteRow | null> {
	return (await db
		.prepare("SELECT * FROM sites WHERE slug = ?")
		.bind(slug)
		.first()) as SiteRow | null;
}

export async function listSites(db: D1Database, userId: number | null): Promise<SiteRow[]> {
	const { clause, params } = siteVisibilityFilter(userId);
	const { results } = await db
		.prepare(
			`SELECT * FROM sites
			 WHERE ${clause}
			 ORDER BY is_default DESC, name ASC`,
		)
		.bind(...params)
		.all();
	return results as unknown as SiteRow[];
}

type UpdatableField =
	| "name"
	| "description"
	| "visibility"
	| "image_source"
	| "image_url"
	| "image_key"
	| "google_place_id"
	| "google_photo_name"
	| "google_attribution"
	| "latitude"
	| "longitude"
	| "address";

export async function updateSite(
	db: D1Database,
	id: number,
	data: Partial<Pick<SiteRow, UpdatableField>>,
): Promise<SiteRow | null> {
	const existing = (await db
		.prepare("SELECT is_default FROM sites WHERE id = ?")
		.bind(id)
		.first()) as { is_default: number } | null;

	if (!existing) return null;
	if (existing.is_default === 1) {
		throw new Error("Cannot modify default site");
	}

	const sets: string[] = [];
	const params: unknown[] = [];
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined) {
			sets.push(`${key} = ?`);
			params.push(value);
		}
	}
	if (sets.length === 0) return getSite(db, id);

	sets.push("updated_at = datetime('now')");
	params.push(id);

	return (await db
		.prepare(`UPDATE sites SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
		.bind(...params)
		.first()) as SiteRow | null;
}

export async function deleteSite(db: D1Database, id: number): Promise<void> {
	const existing = (await db
		.prepare("SELECT is_default FROM sites WHERE id = ?")
		.bind(id)
		.first()) as { is_default: number } | null;

	if (!existing) return;
	if (existing.is_default === 1) {
		throw new Error("Cannot delete default site");
	}

	// Block delete if any mission still references this site as either
	// launch_site_id or target_id — both columns FK into sites.
	const ref = (await db
		.prepare("SELECT COUNT(*) AS count FROM missions WHERE launch_site_id = ? OR target_id = ?")
		.bind(id, id)
		.first()) as { count: number } | null;

	if (ref && ref.count > 0) {
		throw new Error(`Cannot delete site: referenced by ${ref.count} mission(s)`);
	}

	await db.prepare("DELETE FROM sites WHERE id = ?").bind(id).run();
}

export type DefaultSiteSpec = {
	slug: string;
	name: string;
	description: string;
	visibility: SiteRow["visibility"];
	image_source: SiteRow["image_source"];
	image_url: string | null;
	latitude: number | null;
	longitude: number | null;
	address: string | null;
};

/**
 * Upsert a default (bundled) site, keyed by slug.
 * Always sets is_default = 1 and created_by = NULL.
 */
export async function upsertDefaultSite(db: D1Database, spec: DefaultSiteSpec): Promise<void> {
	await db
		.prepare(
			`INSERT INTO sites (
				slug, name, description, visibility,
				image_source, image_url,
				latitude, longitude, address,
				is_default, created_by
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
			ON CONFLICT(slug) DO UPDATE SET
				name = excluded.name,
				description = excluded.description,
				visibility = excluded.visibility,
				image_source = excluded.image_source,
				image_url = excluded.image_url,
				latitude = excluded.latitude,
				longitude = excluded.longitude,
				address = excluded.address,
				is_default = 1,
				created_by = NULL,
				updated_at = datetime('now')`,
		)
		.bind(
			spec.slug,
			spec.name,
			spec.description,
			spec.visibility,
			spec.image_source,
			spec.image_url,
			spec.latitude,
			spec.longitude,
			spec.address,
		)
		.run();
}
