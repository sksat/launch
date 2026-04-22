import type { SiteRow } from "../types";

/**
 * Resolve the public URL to display for a site's hero/thumbnail image.
 *
 * Returns null when:
 *   - No image is configured (image_source = null), or
 *   - image_source='upload' but no image_key is set (should not happen
 *     with a consistent DB, but keeps the UI safe), or
 *   - The image relies on Google Places but the API key isn't available.
 *
 * Uploaded images are served via the Worker-proxied
 * `/sites/:slug/image` route (visibility-checked) rather than via a
 * direct R2 URL. The `?v=` cache-buster forces refetch on visibility
 * changes or image replacement so shared caches never leak stale bytes.
 */
export function resolveSiteImageUrl(
	site: SiteRow,
	opts: { googleEnabled: boolean },
): string | null {
	if (site.image_source === "url") {
		return site.image_url;
	}
	if (site.image_source === "upload") {
		if (!site.image_key) return null;
		return `/sites/${site.slug}/image?v=${encodeURIComponent(site.updated_at)}`;
	}
	if (site.image_source === "google_places") {
		if (!opts.googleEnabled) return null;
		// `?v=<updated_at>` is a cache-buster. Without it, the public-cached
		// edge response for this route can outlive a visibility flip or a
		// `photo_name` change and keep serving stale bytes past its TTL.
		return `/sites/${site.slug}/photo?v=${encodeURIComponent(site.updated_at)}`;
	}
	return null;
}
