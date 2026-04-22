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

export default app;
