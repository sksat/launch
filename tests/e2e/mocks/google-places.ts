import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PNG_BYTES = readFileSync(
	resolve(import.meta.dirname, "../fixtures/test-image.jpg"),
);

/**
 * Minimal HTTP stand-in for Google Places API (New) v1. Covers only the
 * two endpoints our Worker hits:
 *   POST /places:searchText    → returns one fake place with one photo
 *   GET  /places/.../photos/.../media → returns the fixture JPEG
 *
 * The Worker is pointed here via GOOGLE_PLACES_BASE_URL so no outbound
 * requests leave the test host. Default port 5181 — kept separate from
 * wrangler dev's 5180.
 */
export async function startMockPlacesServer(
	port: number,
): Promise<{ server: Server; url: string; calls: string[] }> {
	const calls: string[] = [];
	const server = createServer((req, res) => {
		const path = req.url ?? "";
		calls.push(`${req.method} ${path}`);

		if (req.method === "POST" && path === "/places:searchText") {
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

		if (
			req.method === "GET" &&
			/^\/places\/[^/]+\/photos\/[^/]+\/media(\?|$)/.test(path)
		) {
			res.writeHead(200, { "Content-Type": "image/jpeg" });
			res.end(PNG_BYTES);
			return;
		}

		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end(`Unexpected mock request: ${req.method} ${path}`);
	});

	await new Promise<void>((r) => server.listen(port, r));
	return { server, url: `http://localhost:${port}`, calls };
}
