const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: "read:user",
		state,
	});
	return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(
	clientId: string,
	clientSecret: string,
	code: string,
): Promise<string> {
	const res = await fetch(GITHUB_TOKEN_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code,
		}),
	});
	if (!res.ok) {
		throw new Error(`GitHub token exchange failed: ${res.status}`);
	}
	const data = (await res.json()) as { access_token?: string; error?: string };
	if (data.error || !data.access_token) {
		throw new Error(`GitHub token error: ${data.error ?? "no access_token"}`);
	}
	return data.access_token;
}

export type GitHubUser = {
	id: number;
	login: string;
	name: string | null;
	avatar_url: string;
};

export async function fetchUser(accessToken: string): Promise<GitHubUser> {
	const res = await fetch(GITHUB_USER_URL, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"User-Agent": "launch.sksat.dev",
		},
	});
	if (!res.ok) {
		throw new Error(`GitHub user fetch failed: ${res.status}`);
	}
	return (await res.json()) as GitHubUser;
}
