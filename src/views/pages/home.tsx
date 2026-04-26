import type { FC } from "hono/jsx";
import { parseJstAware } from "../../lib/datetime";
import { pickHeroImage } from "../../lib/hero-image";
import type { MissionRow, SessionUser, SiteRow, UserRow } from "../../types";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { KpiStrip } from "../components/kpi-strip";
import { MissionHero } from "../components/mission-hero";
import { MissionTable } from "../components/mission-table";

function isUpcoming(m: MissionRow): boolean {
	return !["completed", "scrubbed"].includes(m.status);
}

export const HomePage: FC<{
	missions: MissionRow[];
	featuredSite: SiteRow | null;
	featuredTarget: SiteRow | null;
	user: SessionUser | null;
	googleEnabled: boolean;
	friendActivity?: { mission: MissionRow; creator: UserRow }[];
}> = ({ missions, featuredSite, featuredTarget, user, googleEnabled, friendActivity = [] }) => {
	const upcoming = missions.filter(isUpcoming).sort((a, b) => {
		const at = a.scheduled_at ? parseJstAware(a.scheduled_at).getTime() : Infinity;
		const bt = b.scheduled_at ? parseJstAware(b.scheduled_at).getTime() : Infinity;
		return at - bt;
	});
	const past = missions
		.filter((m) => !isUpcoming(m))
		.sort((a, b) => {
			const at = a.scheduled_at ? parseJstAware(a.scheduled_at).getTime() : 0;
			const bt = b.scheduled_at ? parseJstAware(b.scheduled_at).getTime() : 0;
			return bt - at;
		});

	const featured = upcoming[0];
	const upcomingRest = upcoming.slice(1);
	const heroImage = featured
		? pickHeroImage(featured, featuredSite, featuredTarget, { googleEnabled })
		: null;

	const kpis = [
		{ value: missions.length, label: "Total Missions" },
		{ value: upcoming.length, label: "Active Operations" },
		{
			value: past.filter((m) => m.status === "completed").length,
			label: "Completed",
		},
	];

	return (
		<div>
			<Header user={user} />

			{/* HERO */}
			{featured ? (
				<MissionHero
					mission={featured}
					image={heroImage}
					cta={{ label: "View Mission", href: `/missions/${featured.external_id}` }}
				/>
			) : (
				<EmptyHero user={user} />
			)}

			<main class="max-w-[1600px] mx-auto px-6 md:px-12 py-16 md:py-20 space-y-24">
				{/* KPI strip */}
				<section class="reveal-on-scroll grid grid-cols-1 md:grid-cols-2 items-end gap-6 md:gap-12 border-b border-white/[0.08] pb-12">
					<div>
						<div class="eyebrow mb-3">Mission Status</div>
						<h2 class="section-head text-space-white">ONGOING OPERATIONS</h2>
					</div>
					<KpiStrip kpis={kpis} />
				</section>

				{/* UPCOMING */}
				{upcomingRest.length > 0 && (
					<section class="reveal-on-scroll">
						<div class="flex items-end justify-between mb-8">
							<h2 class="section-head text-space-white">UPCOMING LAUNCHES</h2>
							{user && (
								<a
									href="/missions/new"
									class="font-bold text-[11px] uppercase tracking-[1.17px] text-launch-cyan hover:text-space-white tx-btn"
								>
									+ New Mission
								</a>
							)}
						</div>
						<MissionTable missions={upcomingRest} />
					</section>
				)}

				{/* FRIENDS' RECENT ACTIVITY */}
				{user && friendActivity.length > 0 && (
					<section class="reveal-on-scroll">
						<div class="flex items-end justify-between mb-8">
							<h2 class="section-head text-space-white">FRIENDS' RECENT ACTIVITY</h2>
							<a
								href="/friends"
								class="font-bold text-[11px] uppercase tracking-[1.17px] text-launch-cyan hover:text-space-white tx-btn"
							>
								Manage Friends →
							</a>
						</div>
						<ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
							{friendActivity.map(({ mission: m, creator }) => (
								<li key={`fa-${m.id}`}>
									<a
										href={`/missions/${m.external_id}`}
										class="group flex items-center gap-4 p-4 border border-white/[0.08] hover:border-launch-cyan/60 tx-btn rounded"
									>
										<img
											src={creator.avatar_url}
											alt={creator.login}
											width={40}
											height={40}
											class="w-10 h-10 rounded-full flex-shrink-0"
										/>
										<div class="flex-1 min-w-0">
											<div class="flex items-baseline gap-2 flex-wrap">
												<span class="font-bold text-[13px] uppercase tracking-tight text-space-white group-hover:text-launch-cyan tx-btn">
													{m.seq > 1 ? `${m.callsign} #${m.seq}` : m.callsign}
												</span>
												{m.title && (
													<span class="text-[12px] text-space-300 truncate">{m.title}</span>
												)}
											</div>
											<div class="font-mono text-[11px] text-space-500 mt-0.5">
												@{creator.login}
												{m.launch_site ? ` · ${m.launch_site} → ${m.target_orbit ?? "?"}` : ""}
											</div>
										</div>
									</a>
								</li>
							))}
						</ul>
					</section>
				)}

				{/* PAST */}
				{past.length > 0 && (
					<section class="reveal-on-scroll">
						<h2 class="section-head text-space-white mb-8">COMPLETED MISSIONS</h2>
						<MissionTable missions={past} showStatus />
					</section>
				)}

				<div class="text-center pt-4">
					<a
						href="/missions"
						class="font-bold text-[11px] uppercase tracking-[1.17px] text-space-500 hover:text-space-100 tx-btn"
					>
						View All Missions →
					</a>
				</div>
			</main>

			<Footer heroCredit={heroImage?.credit ?? null} />
		</div>
	);
};

const EmptyHero: FC<{ user: SessionUser | null }> = ({ user }) => (
	<section
		class="relative w-full overflow-hidden bg-black"
		style="height: min(70vh, 600px); min-height: 480px;"
	>
		<div class="starfield" aria-hidden="true" />
		<div
			class="absolute inset-0 pointer-events-none"
			style="background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(74,158,255,0.15), transparent 70%);"
		/>
		<div class="relative h-full flex flex-col items-center justify-center text-center px-6">
			<div class="reveal-subheader eyebrow mb-3">Mission Control</div>
			<div class="reveal-header">
				<h1 class="hero-title text-space-white text-7xl md:text-[160px]">LAUNCH</h1>
			</div>
			<p class="reveal-subheader mt-4 text-space-400 max-w-md">
				No missions on the manifest. All systems nominal.
			</p>
			<div class="reveal-button mt-8">
				<a
					href={user ? "/missions/new" : "/auth/login"}
					class="inline-flex items-center gap-3 px-6 py-2.5 border border-white/30 hover:border-launch-cyan hover:bg-launch-cyan/10 tx-btn text-space-100 hover:text-launch-cyan font-bold text-[12px] uppercase tracking-[1.17px]"
				>
					{user ? "Initiate Mission" : "Sign In"} →
				</a>
			</div>
		</div>
		<div class="horizon" aria-hidden="true" />
	</section>
);
