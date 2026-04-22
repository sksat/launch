import type { UserRow } from "../types";

/**
 * Store all GitHub logins lowercased. GitHub logins are case-insensitive
 * in the upstream service ("Sksat" and "sksat" refer to the same account),
 * but D1 string equality is case-sensitive by default. Normalizing at the
 * write boundary keeps every lookup unambiguous.
 */
export async function upsertUser(
	db: D1Database,
	user: { id: number; login: string; display_name: string; avatar_url: string },
): Promise<UserRow> {
	const login = user.login.toLowerCase();
	await db
		.prepare(
			`INSERT INTO users (id, login, display_name, avatar_url)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET
				login = excluded.login,
				display_name = excluded.display_name,
				avatar_url = excluded.avatar_url,
				updated_at = datetime('now')`,
		)
		.bind(user.id, login, user.display_name, user.avatar_url)
		.run();

	return (await db.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first()) as UserRow;
}

export async function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
	return (await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first()) as UserRow | null;
}

export async function getUserByLogin(db: D1Database, login: string): Promise<UserRow | null> {
	// Accept any casing; logins are stored lowercased by upsertUser.
	return (await db
		.prepare("SELECT * FROM users WHERE login = ?")
		.bind(login.toLowerCase())
		.first()) as UserRow | null;
}

export async function getUsersByIds(db: D1Database, ids: number[]): Promise<UserRow[]> {
	if (ids.length === 0) return [];
	const placeholders = ids.map(() => "?").join(",");
	const { results } = await db
		.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`)
		.bind(...ids)
		.all();
	return results as unknown as UserRow[];
}
