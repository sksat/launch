import { describe, expect, it } from "vitest";
import { generateShortId } from "../../src/lib/short-id";

describe("generateShortId", () => {
	it("returns an 8-character string", () => {
		expect(generateShortId()).toHaveLength(8);
	});

	it("uses only base62 characters [0-9A-Za-z]", () => {
		// Sample widely so a charset bug surfaces.
		for (let i = 0; i < 200; i++) {
			expect(generateShortId()).toMatch(/^[0-9A-Za-z]{8}$/);
		}
	});

	it("does not collide across 1000 sequential calls", () => {
		// 62^8 ≈ 2.18 × 10^14, so 1000 draws have collision probability ~2 × 10⁻⁹.
		// A flake here means the generator is not actually random.
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(generateShortId());
		}
		expect(seen.size).toBe(1000);
	});
});
