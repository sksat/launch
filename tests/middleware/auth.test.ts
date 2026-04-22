import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

// Wrap hono/cookie so individual tests can force getSignedCookie to throw,
// simulating a rotated/empty SESSION_SECRET or a crypto import failure.
// (ESM exports can't be spied on in-place.)
vi.mock("hono/cookie", async () => {
	const actual = await vi.importActual<typeof import("hono/cookie")>("hono/cookie");
	return {
		...actual,
		getSignedCookie: vi.fn(actual.getSignedCookie),
	};
});

import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { authMiddleware } from "../../src/middleware/auth";
import type { AppEnv } from "../../src/types";

function appWithAuth() {
	const app = new Hono<AppEnv>();
	app.use(authMiddleware);
	app.get("/", (c) => c.json({ user: c.var.user }));
	return app;
}

function envWithSecret(secret: string | undefined) {
	// Only the fields authMiddleware reads from c.env need to be real.
	return { SESSION_SECRET: secret } as unknown as AppEnv["Bindings"];
}

afterEach(() => {
	vi.mocked(getSignedCookie).mockReset();
	// Restore to the real implementation for subsequent tests.
	vi.mocked(getSignedCookie).mockImplementation(
		(async (...args: unknown[]) => {
			const mod = await vi.importActual<typeof import("hono/cookie")>("hono/cookie");
			// biome-ignore lint/suspicious/noExplicitAny: pass-through to real impl
			return (mod.getSignedCookie as any)(...args);
		}) as unknown as typeof getSignedCookie,
	);
});

describe("authMiddleware", () => {
	it("sets user=null and calls next when no session cookie is present", async () => {
		const app = appWithAuth();
		const res = await app.request("/", {}, envWithSecret("test-secret"));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: null });
	});

	it("sets user from a valid signed cookie", async () => {
		const secret = "test-secret";
		const minter = new Hono();
		minter.get("/mint", async (c) => {
			await setSignedCookie(
				c,
				"session",
				JSON.stringify({ u: 42, l: "sksat", e: 9_999_999_999 }),
				secret,
				{ path: "/" },
			);
			return c.text("ok");
		});
		const mintRes = await minter.request("/mint");
		const setCookie = mintRes.headers.get("set-cookie");
		if (!setCookie) throw new Error("mint did not set cookie");
		const cookieHeader = setCookie.split(";")[0];

		const app = appWithAuth();
		const res = await app.request(
			"/",
			{ headers: { cookie: cookieHeader } },
			envWithSecret(secret),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: { id: 42, login: "sksat" } });
	});

	it("clears the session cookie and falls back to null when payload JSON is malformed", async () => {
		const secret = "test-secret";
		const minter = new Hono();
		minter.get("/mint", async (c) => {
			await setSignedCookie(c, "session", "not-json", secret, { path: "/" });
			return c.text("ok");
		});
		const mintRes = await minter.request("/mint");
		const setCookie = mintRes.headers.get("set-cookie");
		if (!setCookie) throw new Error("mint did not set cookie");
		const cookieHeader = setCookie.split(";")[0];

		const app = appWithAuth();
		const res = await app.request(
			"/",
			{ headers: { cookie: cookieHeader } },
			envWithSecret(secret),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: null });
		const clear = res.headers.get("set-cookie") ?? "";
		expect(clear).toMatch(/session=/);
		expect(clear).toMatch(/Max-Age=0/i);
	});

	it("does NOT propagate an exception when cookie decode itself throws", async () => {
		// Simulate getSignedCookie throwing (SESSION_SECRET rotated/empty,
		// crypto import failure, etc.). Without the fix this bubbles out of
		// the global middleware and every route returns 500.
		vi.mocked(getSignedCookie).mockImplementation((async () => {
			throw new Error("synthetic cookie decode failure");
		}) as unknown as typeof getSignedCookie);

		const app = appWithAuth();
		const res = await app.request(
			"/",
			{ headers: { cookie: "session=whatever" } },
			envWithSecret(""),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: null });
		const clear = res.headers.get("set-cookie") ?? "";
		expect(clear).toMatch(/session=/);
		expect(clear).toMatch(/Max-Age=0/i);
	});
});
