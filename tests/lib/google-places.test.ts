import { describe, it, expect, vi, beforeEach } from "vitest";
import { findPlaceForSite, buildPhotoMediaUrl } from "../../src/lib/google-places";

describe("findPlaceForSite", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("POSTs to searchText with required field mask header", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					places: [
						{
							id: "ChIJabc",
							photos: [
								{
									name: "places/ChIJabc/photos/AelY_xyz",
									authorAttributions: [{ displayName: "John Doe" }],
								},
							],
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);

		const result = await findPlaceForSite("API_KEY_1", "カレーうどん ZEYO.");

		expect(fetchSpy).toHaveBeenCalledOnce();
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
		const headers = (init!.headers as Record<string, string>);
		expect(headers["X-Goog-Api-Key"]).toBe("API_KEY_1");
		expect(headers["X-Goog-FieldMask"]).toContain("places.id");
		expect(headers["X-Goog-FieldMask"]).toContain("places.photos");
		expect(JSON.parse(init!.body as string)).toEqual({
			textQuery: "カレーうどん ZEYO.",
		});
		expect(result).toEqual({
			place_id: "ChIJabc",
			photo_name: "places/ChIJabc/photos/AelY_xyz",
			attribution: "John Doe",
		});
	});

	it("returns null when no places found", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ places: [] }), { status: 200 }),
		);
		const result = await findPlaceForSite("K", "nowhere");
		expect(result).toBeNull();
	});

	it("returns place but null photo fields when place has no photos", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ places: [{ id: "ChIJ2", photos: [] }] }),
				{ status: 200 },
			),
		);
		const result = await findPlaceForSite("K", "bare");
		expect(result).toEqual({
			place_id: "ChIJ2",
			photo_name: null,
			attribution: null,
		});
	});

	it("throws on non-2xx", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("forbidden", { status: 403 }),
		);
		await expect(findPlaceForSite("K", "x")).rejects.toThrow(/403/);
	});
});

describe("buildPhotoMediaUrl", () => {
	it("builds media url with maxWidthPx and key param", () => {
		const url = buildPhotoMediaUrl(
			"places/ChIJabc/photos/AelY_xyz",
			"API_KEY_2",
			1200,
		);
		expect(url).toBe(
			"https://places.googleapis.com/v1/places/ChIJabc/photos/AelY_xyz/media?maxWidthPx=1200&key=API_KEY_2",
		);
	});

	it("honors override baseUrl for test mocks", () => {
		const url = buildPhotoMediaUrl(
			"places/X/photos/Y",
			"K",
			800,
			"http://localhost:5181",
		);
		expect(url).toBe(
			"http://localhost:5181/places/X/photos/Y/media?maxWidthPx=800&key=K",
		);
	});
});
