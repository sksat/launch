import type { Page } from "@playwright/test";

/**
 * Log in as one of the allowed-users.json users using MOCK_AUTH=true.
 * Hits the mock-callback directly, bypassing the picker UI.
 */
export async function loginAs(page: Page, login: string): Promise<void> {
	const response = await page.goto(
		`/auth/mock-callback?login=${encodeURIComponent(login)}&redirect=/`,
	);
	if (!response || !response.ok()) {
		throw new Error(`Mock login failed for ${login}: ${response?.status()}`);
	}
}

export async function logout(page: Page): Promise<void> {
	await page.context().clearCookies();
}
