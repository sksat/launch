import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { upcomingMissionsMiddleware } from "./middleware/upcoming-missions";
import { renderer } from "./renderer";
import { authRoutes } from "./routes/auth";
import { friendsRoutes } from "./routes/friends";
import { homeRoutes } from "./routes/home";
import { missionRoutes } from "./routes/missions";
import { pollRoutes } from "./routes/polls";
import { siteRoutes } from "./routes/sites";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// Global middleware
app.use(renderer);
app.use(authMiddleware);
app.use(upcomingMissionsMiddleware);

// Routes
app.route("/auth", authRoutes);
app.route("/", homeRoutes);
app.route("/missions", missionRoutes);
app.route("/missions", pollRoutes);
app.route("/sites", siteRoutes);
app.route("/friends", friendsRoutes);

// Global error handler: surface the real stack to `wrangler tail` / CF
// Dashboard logs (there is no other observability path in prod) and render
// a minimal 500 page in the same tone as the ACCESS DENIED view.
app.onError((err, c) => {
	const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
	console.error(`[onError] ${c.req.method} ${c.req.url}\n${stack}`);
	return c.html(
		<div class="min-h-screen flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-launch-red mb-2">ABORT</h1>
				<p class="text-space-500">Something exploded on the pad. Check telemetry.</p>
			</div>
		</div>,
		500,
	);
});

export default app;
