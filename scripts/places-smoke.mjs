#!/usr/bin/env node
/**
 * Verify a Google Places API (New) key works end-to-end without spinning
 * up the dev server. Reads GOOGLE_MAPS_API_KEY and (optional)
 * GOOGLE_PLACES_BASE_URL from .dev.vars.
 *
 * Usage:
 *   pnpm places:smoke "カレーうどん ZEYO. つくば"
 *   pnpm places:smoke                       # default sample query
 *
 * Prints the first match's place_id, name, and first photo resource name.
 * A full Text Search call costs ~$0.032 (free under the $200/month credit).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_VARS = resolve(__dirname, "../.dev.vars");

function loadDevVars() {
	const vars = {};
	try {
		const content = readFileSync(DEV_VARS, "utf8");
		for (const line of content.split("\n")) {
			const eq = line.indexOf("=");
			if (eq < 0) continue;
			const k = line.slice(0, eq).trim();
			const v = line.slice(eq + 1).trim();
			if (k) vars[k] = v;
		}
	} catch {
		// fall through — env may still be set via shell
	}
	return vars;
}

const fileVars = loadDevVars();
const key = process.env.GOOGLE_MAPS_API_KEY || fileVars.GOOGLE_MAPS_API_KEY;
if (!key) {
	console.error(
		"GOOGLE_MAPS_API_KEY not set. Add it to .dev.vars or export in the shell.",
	);
	process.exit(1);
}
const base =
	process.env.GOOGLE_PLACES_BASE_URL ||
	fileVars.GOOGLE_PLACES_BASE_URL ||
	"https://places.googleapis.com/v1";

const query = process.argv.slice(2).join(" ") || "カレーうどん ZEYO. つくば";

console.log(`[smoke] POST ${base}/places:searchText`);
console.log(`[smoke] query: ${query}`);

const res = await fetch(`${base.replace(/\/$/, "")}/places:searchText`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"X-Goog-Api-Key": key,
		"X-Goog-FieldMask":
			"places.id,places.displayName,places.formattedAddress,places.photos.name,places.photos.authorAttributions",
	},
	body: JSON.stringify({ textQuery: query }),
});

console.log(`[smoke] status: ${res.status}`);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

if (!res.ok) process.exit(1);

const first = data.places?.[0];
if (!first) {
	console.error("[smoke] no places matched — not a key error, just empty result");
	process.exit(0);
}
console.log(`[smoke] ✓ got place_id=${first.id}`);
if (first.photos?.[0]) {
	const photoUrl = `${base.replace(/\/$/, "")}/${first.photos[0].name}/media?maxWidthPx=400&key=${key}`;
	// Mask the key unless explicitly asked — the URL is handy in a local
	// terminal but risky when piped into agents / logs / screenshots.
	const showKey = process.env.PLACES_SMOKE_SHOW_KEY === "1";
	const printed = showKey
		? photoUrl
		: photoUrl.replace(key, `${key.slice(0, 4)}…${key.slice(-4)}`);
	console.log(`[smoke] first photo media URL:`);
	console.log(`  ${printed}`);
	if (!showKey) {
		console.log(
			`  (key masked; re-run with PLACES_SMOKE_SHOW_KEY=1 to reveal)`,
		);
	}
}
