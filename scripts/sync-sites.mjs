#!/usr/bin/env node
/**
 * Sync sites.json into D1 as is_default=1 rows.
 *
 * Usage:
 *   node scripts/sync-sites.mjs [--remote]
 *
 * Generates an INSERT ... ON CONFLICT(slug) DO UPDATE statement per site
 * and pipes them through `wrangler d1 execute`.
 */

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const JSON_PATH = resolve(REPO_ROOT, "sites.json");

const remote = process.argv.includes("--remote");

function quote(value) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return String(value);
	const escaped = String(value).replace(/'/g, "''");
	return `'${escaped}'`;
}

const sites = JSON.parse(await readFile(JSON_PATH, "utf8"));
if (!Array.isArray(sites)) {
	console.error("sites.json must be an array");
	process.exit(1);
}

const statements = sites.map((s) => {
	const cols = [
		quote(s.slug),
		quote(s.name),
		quote(s.description ?? ""),
		quote(s.visibility ?? "authenticated"),
		quote(s.image_source ?? null),
		quote(s.image_url ?? null),
		s.latitude ?? "NULL",
		s.longitude ?? "NULL",
		quote(s.address ?? null),
	].join(", ");
	return `INSERT INTO sites (slug, name, description, visibility, image_source, image_url, latitude, longitude, address, is_default, created_by)
VALUES (${cols}, 1, NULL)
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
  updated_at = datetime('now');`;
});

const sql = statements.join("\n");
// Allow callers (like the E2E globalSetup) to target a non-default
// miniflare persistence dir via WRANGLER_PERSIST_TO.
const persistTo = !remote && process.env.WRANGLER_PERSIST_TO;
const args = [
	"wrangler",
	"d1",
	"execute",
	"launch-db",
	remote ? "--remote" : "--local",
	...(persistTo ? ["--persist-to", persistTo] : []),
	"--command",
	sql,
];

console.log(`Syncing ${sites.length} default sites (${remote ? "remote" : "local"})...`);
const result = spawnSync("pnpm", args, { stdio: "inherit", cwd: REPO_ROOT });
process.exit(result.status ?? 1);
