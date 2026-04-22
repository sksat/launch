#!/usr/bin/env node
// Entry point for running the mock Google Places server as a detached
// child process. Stays alive until SIGTERM.
//
// Also exposes small debug endpoints used by E2E tests:
//   GET    /_calls → list of { method, path, timestamp } for recorded calls
//   DELETE /_calls → reset recording

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
	resolve(__dirname, "../fixtures/test-image.jpg"),
);

const PORT = Number(process.env.MOCK_PLACES_PORT ?? 5181);
const PHOTO_PATH_RE = /^\/places\/[^/]+\/photos\/[^/]+\/media(\?|$)/;

let calls = [];

const server = createServer((req, res) => {
	const path = req.url ?? "";

	// Debug endpoints (not recorded in calls)
	if (req.method === "GET" && path === "/_calls") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(calls));
		return;
	}
	if (req.method === "DELETE" && path === "/_calls") {
		calls = [];
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.method === "POST" && path === "/places:searchText") {
		calls.push({ method: req.method, path, timestamp: Date.now() });
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				places: [
					{
						id: "ChIJmockPlace",
						photos: [
							{
								name: "places/ChIJmockPlace/photos/mockPhoto",
								authorAttributions: [
									{ displayName: "Mock Photographer" },
								],
							},
						],
					},
				],
			}),
		);
		return;
	}
	if (req.method === "GET" && PHOTO_PATH_RE.test(path)) {
		calls.push({ method: req.method, path, timestamp: Date.now() });
		res.writeHead(200, { "Content-Type": "image/jpeg" });
		res.end(FIXTURE);
		return;
	}
	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end(`mock: unexpected ${req.method} ${path}`);
});

server.listen(PORT, () => {
	console.log(`[mock-places] listening on :${PORT}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
	process.on(sig, () => {
		server.close(() => process.exit(0));
	});
}
