/**
 * Thin wrapper for Google Places API (New, v1) used to auto-fetch a hero
 * photo for user-registered launch sites when no image is supplied.
 *
 * Why: for places like restaurants ("カレーうどん ZEYO.") users rarely have
 * a hero image handy, but Google has one. Attribution is mandatory per TOS.
 *
 * The base URL is overridable via `baseUrl` so E2E tests can point the
 * Worker at a local mock server.
 */

export const DEFAULT_PLACES_BASE_URL = "https://places.googleapis.com/v1";

export type PlaceLookupResult = {
	place_id: string;
	photo_name: string | null;
	attribution: string | null;
};

export async function findPlaceForSite(
	apiKey: string,
	textQuery: string,
	baseUrl: string = DEFAULT_PLACES_BASE_URL,
): Promise<PlaceLookupResult | null> {
	const res = await fetch(`${baseUrl.replace(/\/$/, "")}/places:searchText`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": apiKey,
			"X-Goog-FieldMask": "places.id,places.photos",
		},
		body: JSON.stringify({ textQuery }),
	});

	if (!res.ok) {
		throw new Error(`Places searchText failed: ${res.status}`);
	}

	const data = (await res.json()) as {
		places?: Array<{
			id: string;
			photos?: Array<{
				name: string;
				authorAttributions?: Array<{ displayName?: string }>;
			}>;
		}>;
	};

	const place = data.places?.[0];
	if (!place) return null;

	const photo = place.photos?.[0];
	return {
		place_id: place.id,
		photo_name: photo?.name ?? null,
		attribution: photo?.authorAttributions?.[0]?.displayName ?? null,
	};
}

export function buildPhotoMediaUrl(
	photoName: string,
	apiKey: string,
	maxWidthPx: number,
	baseUrl: string = DEFAULT_PLACES_BASE_URL,
): string {
	return `${baseUrl.replace(/\/$/, "")}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}
