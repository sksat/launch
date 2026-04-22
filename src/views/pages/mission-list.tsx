import type { FC } from "hono/jsx";
import type { MissionRow, SessionUser } from "../../types";
import { Header } from "../components/header";
import { MissionCard } from "../components/mission-card";

export const MissionListPage: FC<{
	missions: MissionRow[];
	user: SessionUser | null;
}> = ({ missions, user }) => (
	<div>
		<Header user={user} />

		<main class="max-w-6xl mx-auto px-4 py-12">
			<div class="flex items-center justify-between mb-8">
				<h1 class="text-2xl font-bold tracking-wider text-space-white uppercase">
					Mission Manifest
				</h1>
				{user && (
					<a
						href="/missions/new"
						class="px-4 py-2 bg-launch-blue text-space-white text-sm uppercase tracking-wider rounded hover:bg-launch-cyan transition-colors"
					>
						New Mission
					</a>
				)}
			</div>

			{/* Filters */}
			<div class="flex gap-3 mb-8">
				<a
					href="/missions"
					class="text-xs uppercase tracking-wider px-3 py-1.5 rounded border border-space-700 text-space-400 hover:text-space-200 hover:border-space-500 transition-colors"
				>
					All
				</a>
				<a
					href="/missions?type=rideshare"
					class="text-xs uppercase tracking-wider px-3 py-1.5 rounded border border-space-700 text-space-400 hover:text-space-200 hover:border-space-500 transition-colors"
				>
					Rideshare
				</a>
				<a
					href="/missions?type=refueling"
					class="text-xs uppercase tracking-wider px-3 py-1.5 rounded border border-space-700 text-space-400 hover:text-space-200 hover:border-space-500 transition-colors"
				>
					Refueling
				</a>
				<a
					href="/missions?type=special"
					class="text-xs uppercase tracking-wider px-3 py-1.5 rounded border border-space-700 text-space-400 hover:text-space-200 hover:border-space-500 transition-colors"
				>
					Special
				</a>
			</div>

			{missions.length === 0 ? (
				<div class="text-center py-16 border border-space-800 rounded-lg">
					<p class="text-space-500">No missions match the current filter.</p>
				</div>
			) : (
				<div class="space-y-3">
					{missions.map((m) => (
						<MissionCard key={m.id} mission={m} />
					))}
				</div>
			)}
		</main>
	</div>
);
