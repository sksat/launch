export type Bindings = {
	DB: D1Database;
	SITE_IMAGES: R2Bucket;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	SESSION_SECRET: string;
	GOOGLE_MAPS_API_KEY?: string; // required for google_places image_source
	GOOGLE_PLACES_BASE_URL?: string; // override Places API base (for tests); default: https://places.googleapis.com/v1
	MOCK_AUTH?: string; // "true" to enable mock auth (dev only)
};

export type SessionUser = {
	id: number;
	login: string;
};

export type UpcomingMissionEntry = {
	mission: MissionRow;
	thumbnail: { src: string; alt: string } | null;
};

export type Variables = {
	user: SessionUser | null;
	// Top N upcoming missions (with resolved thumbnail), populated
	// globally by upcomingMissionsMiddleware so Header's mega menu
	// can render them.
	upcomingMissions: UpcomingMissionEntry[];
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: Variables;
};

// ---------- D1 row types ----------

export type UserRow = {
	id: number;
	login: string;
	display_name: string;
	avatar_url: string;
	created_at: string;
	updated_at: string;
};

export type MissionRow = {
	id: number;
	// Opaque UUID v4 for URL addressing (/missions/:external_id). The
	// INTEGER `id` stays as the FK authority for participants/polls/etc.;
	// callers should resolve external_id → id at the route boundary and
	// use the integer id internally.
	external_id: string;
	template_id: string;
	callsign: string;
	seq: number;
	title: string;
	description: string;
	visibility: "public" | "authenticated" | "friends" | "participants";
	status: "planning" | "scheduled" | "go" | "completed" | "scrubbed";
	scheduled_at: string | null;
	launch_site: string | null;
	launch_site_id: number | null;
	target_orbit: string | null;
	target_id: number | null;
	vehicle: string | null;
	created_by: number;
	created_at: string;
	updated_at: string;
};

// A site is the canonical "registered place" — used by missions as both
// launch_site (origin) and target (destination). The split into separate
// launch_sites / targets tables was retired in 0004_unify_sites.sql.
export type SiteRow = {
	id: number;
	slug: string;
	name: string;
	description: string;
	visibility: "public" | "authenticated" | "friends" | "private";
	image_source: "url" | "upload" | "google_places" | null;
	// For image_source='url': external URL. For 'upload': null (use image_key).
	image_url: string | null;
	// For image_source='upload': R2 object key (e.g. sites/42/abc-def.jpg).
	// Served via /sites/:slug/image (visibility-checked).
	image_key: string | null;
	google_place_id: string | null;
	google_photo_name: string | null;
	google_attribution: string | null;
	latitude: number | null;
	longitude: number | null;
	address: string | null;
	is_default: number; // 0 | 1 (SQLite stores boolean as int)
	created_by: number | null;
	created_at: string;
	updated_at: string;
};

export type ParticipantRow = {
	mission_id: number;
	user_id: number;
	role: "commander" | "crew";
	boarded_at: string;
};

export type PollRow = {
	id: number;
	mission_id: number;
	title: string;
	closes_at: string | null;
	is_closed: number;
	created_by: number;
	created_at: string;
};

export type PollOptionRow = {
	id: number;
	poll_id: number;
	starts_at: string;
	ends_at: string;
	sort_order: number;
};

export type VoteRow = {
	option_id: number;
	user_id: number;
	availability: "available" | "maybe" | "unavailable";
	voted_at: string;
};

export type FriendshipStatus = "pending" | "accepted";

export type FriendshipRow = {
	requester_id: number;
	addressee_id: number;
	status: FriendshipStatus;
	created_at: string;
	responded_at: string | null;
};
