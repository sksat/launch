/**
 * Interpret a `<input type="datetime-local">` value as JST and return an
 * ISO string with an explicit +09:00 offset. The UI is JST-only, so a
 * bare `2026-04-20T05:00` would otherwise be parsed as UTC on Workers
 * and render as 14:00 JST after timezone formatting.
 */
export function jstIsoFromFormInput(raw: string | null | undefined): string | null {
	if (!raw) return null;
	// datetime-local can be YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS.
	// Ensure we have seconds before appending the offset.
	const withSeconds = /:\d\d:\d\d$/.test(raw) ? raw : `${raw}:00`;
	return `${withSeconds}+09:00`;
}

/**
 * Parse a stored timestamp into a Date, treating offset-less values as
 * JST wall-clock time. The form pipeline (`jstIsoFromFormInput`) always
 * produces `+09:00`-suffixed strings, but seed data and legacy rows can
 * land in D1 as `YYYY-MM-DD HH:MM:SS` with no offset, which `new Date`
 * would otherwise interpret in the worker's local TZ (UTC on
 * Cloudflare). Anchoring to JST keeps display/format paths consistent
 * with how the value was authored.
 */
export function parseJstAware(iso: string): Date {
	if (/[Zz]$|[+-]\d\d:?\d\d$/.test(iso)) return new Date(iso);
	const withT = iso.includes("T") ? iso : iso.replace(" ", "T");
	return new Date(`${withT}+09:00`);
}

/**
 * Hour component of an ISO timestamp in JST. Used for hour-based
 * callsign patterns (T-{hour}, L-{hour}, V-{hour}).
 */
export function jstHourOf(iso: string): number {
	return Number(
		parseJstAware(iso).toLocaleString("en-US", {
			hour: "numeric",
			hour12: false,
			timeZone: "Asia/Tokyo",
		}),
	);
}

/**
 * Format an ISO timestamp as the `YYYY-MM-DDTHH:MM` string that
 * `<input type="datetime-local">` expects, with the time converted to
 * JST. Using the Swedish locale yields ISO-ish output we can normalize
 * in one pass — avoiding ad-hoc padStart handling per component.
 */
export function isoToJstDatetimeLocal(iso: string | null | undefined): string {
	if (!iso) return "";
	// "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
	return parseJstAware(iso)
		.toLocaleString("sv-SE", { timeZone: "Asia/Tokyo", hour12: false })
		.replace(" ", "T")
		.slice(0, 16);
}
