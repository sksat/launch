import { resolve } from "node:path";
import { existsSync, readFileSync, unlinkSync, copyFileSync } from "node:fs";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const DEV_VARS = resolve(REPO_ROOT, ".dev.vars");
const DEV_VARS_BACKUP = resolve(REPO_ROOT, ".dev.vars.e2e-backup");
const MOCK_PID_FILE = resolve(REPO_ROOT, ".e2e-mock.pid");

export default async function globalTeardown() {
	// Kill the detached mock server
	if (existsSync(MOCK_PID_FILE)) {
		const pid = Number(readFileSync(MOCK_PID_FILE, "utf8").trim());
		try {
			if (pid > 0) process.kill(pid, "SIGTERM");
		} catch {
			/* already gone */
		}
		unlinkSync(MOCK_PID_FILE);
	}

	// Restore pre-test .dev.vars if we swapped it
	if (existsSync(DEV_VARS_BACKUP)) {
		copyFileSync(DEV_VARS_BACKUP, DEV_VARS);
		unlinkSync(DEV_VARS_BACKUP);
		console.log("[e2e] .dev.vars restored");
	}
}
