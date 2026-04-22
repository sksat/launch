import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie, setSignedCookie } from "hono/cookie";
import { upsertUser } from "../db/users";
import { getAllAllowedUsers, isAllowedUser } from "../lib/allowed-users";
import { buildAuthorizeUrl, exchangeCode, fetchUser } from "../lib/github";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>();

function isMockAuth(c: { env: { MOCK_AUTH?: string } }): boolean {
	return c.env.MOCK_AUTH === "true";
}

/**
 * Accept only same-origin absolute paths for post-login redirect.
 * Rejects full URLs, protocol-relative (`//evil`), and backslash tricks
 * (`/\evil`) that some browsers coerce into a host change.
 */
function sanitizeRedirect(raw: string | undefined | null): string {
	if (!raw) return "/";
	if (!raw.startsWith("/")) return "/";
	if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
	return raw;
}

// ---------- Mock auth: user picker ----------

authRoutes.get("/login", async (c) => {
	const redirect = sanitizeRedirect(c.req.query("redirect"));

	if (isMockAuth(c)) {
		const users = getAllAllowedUsers();
		return c.render(
			<div class="min-h-screen flex items-center justify-center">
				<div class="w-full max-w-sm">
					<h1 class="text-xl font-bold tracking-wider text-space-white uppercase mb-1 text-center">
						Mock Login
					</h1>
					<p class="text-xs text-space-500 text-center mb-6 uppercase tracking-wider">
						Development Mode
					</p>
					<div class="space-y-2">
						{users.map((u) => (
							<a
								key={u.github}
								href={`/auth/mock-callback?login=${encodeURIComponent(u.github)}&redirect=${encodeURIComponent(redirect)}`}
								class="flex items-center justify-between p-3 border border-space-700 rounded-lg hover:border-launch-cyan hover:bg-launch-cyan/5 transition-colors group"
							>
								<div>
									<span class="text-sm font-mono text-space-200 group-hover:text-launch-cyan transition-colors">
										{u.github}
									</span>
									<span class="ml-2 text-xs text-space-500">{u.name}</span>
								</div>
								<span class="text-[10px] uppercase tracking-widest text-space-600 px-1.5 py-0.5 border border-space-700 rounded">
									{u.role}
								</span>
							</a>
						))}
					</div>
				</div>
			</div>,
		);
	}

	// Real OAuth flow
	const state = crypto.randomUUID();

	setCookie(c, "oauth_state", state, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 600,
	});
	setCookie(c, "oauth_redirect", redirect, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 600,
	});

	const callbackUrl = new URL("/auth/callback", c.req.url).toString();
	const url = buildAuthorizeUrl(c.env.GITHUB_CLIENT_ID, callbackUrl, state);
	return c.redirect(url);
});

// ---------- Mock callback ----------

authRoutes.get("/mock-callback", async (c) => {
	if (!isMockAuth(c)) {
		return c.text("Mock auth is not enabled", 403);
	}

	const login = c.req.query("login");
	const redirect = sanitizeRedirect(c.req.query("redirect"));
	if (!login || !isAllowedUser(login)) {
		return c.text("Invalid user", 400);
	}

	// Use deterministic fake IDs for mock users (hash of login)
	const encoder = new TextEncoder();
	const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(login));
	const hashArr = new Uint32Array(hashBuf);
	const fakeId = hashArr[0] % 1_000_000;

	await upsertUser(c.env.DB, {
		id: fakeId,
		login,
		display_name: login,
		avatar_url: `https://github.com/${login}.png?size=80`,
	});

	const sessionPayload = JSON.stringify({
		u: fakeId,
		l: login,
		e: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
	});

	await setSignedCookie(c, "session", sessionPayload, c.env.SESSION_SECRET, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 7 * 24 * 60 * 60,
	});

	return c.redirect(redirect);
});

// ---------- Real OAuth callback ----------

authRoutes.get("/callback", async (c) => {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const storedState = getCookie(c, "oauth_state");
	const redirect = sanitizeRedirect(getCookie(c, "oauth_redirect"));

	// Must match the attributes the cookie was set with or browsers
	// emit a separate expired cookie on a different path, leaving the
	// original in place.
	deleteCookie(c, "oauth_state", { path: "/", secure: true });
	deleteCookie(c, "oauth_redirect", { path: "/", secure: true });

	if (!code || !state || state !== storedState) {
		return c.text("Invalid OAuth state", 400);
	}

	const accessToken = await exchangeCode(c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET, code);
	const ghUser = await fetchUser(accessToken);

	if (!isAllowedUser(ghUser.login)) {
		c.status(403);
		return c.render(
			<div class="min-h-screen flex items-center justify-center">
				<div class="text-center max-w-md">
					<h1 class="text-2xl font-bold text-launch-red mb-4">ACCESS DENIED</h1>
					<p class="text-space-400 mb-4">
						<span class="font-mono text-space-200">{ghUser.login}</span> is not in the authorized
						crew manifest.
					</p>
					<p class="text-space-500 text-sm">
						Submit a PR to <span class="font-mono text-launch-cyan">allowed-users.json</span> to
						request access.
					</p>
				</div>
			</div>,
		);
	}

	await upsertUser(c.env.DB, {
		id: ghUser.id,
		login: ghUser.login,
		display_name: ghUser.name ?? ghUser.login,
		avatar_url: ghUser.avatar_url,
	});

	const sessionPayload = JSON.stringify({
		u: ghUser.id,
		l: ghUser.login,
		e: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
	});

	await setSignedCookie(c, "session", sessionPayload, c.env.SESSION_SECRET, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 7 * 24 * 60 * 60,
	});

	return c.redirect(redirect);
});

// ---------- Logout ----------

authRoutes.post("/logout", async (c) => {
	deleteCookie(c, "session", { path: "/", secure: true });
	return c.redirect("/");
});
