import data from "../../allowed-users.json";

type AllowedUser = {
	github: string;
	name: string;
	role: "admin" | "member";
};

const allowedMap = new Map<string, AllowedUser>(
	data.users.map((u) => [u.github.toLowerCase(), u as AllowedUser]),
);

export function isAllowedUser(login: string): boolean {
	return allowedMap.has(login.toLowerCase());
}

export function isAdmin(login: string): boolean {
	return allowedMap.get(login.toLowerCase())?.role === "admin";
}

export function getAllowedUser(login: string): AllowedUser | undefined {
	return allowedMap.get(login.toLowerCase());
}

export function getAllAllowedUsers(): AllowedUser[] {
	return data.users as AllowedUser[];
}
