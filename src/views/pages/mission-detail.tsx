import type { FC } from "hono/jsx";
import type { ParticipantWithUser } from "../../db/participants";
import type { PollWithOptions } from "../../db/polls";
import { pickHeroImage } from "../../lib/hero-image";
import { getTemplate } from "../../lib/templates";
import type { MissionRow, SessionUser, SiteRow } from "../../types";
import { CountdownTimeline, defaultTimeline } from "../components/countdown-timeline";
import { CrewList } from "../components/crew-list";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { MissionHero } from "../components/mission-hero";
import { PollGrid } from "../components/poll-grid";

function formatLaunchDate(iso: string | null): { date: string; time: string } {
	if (!iso) return { date: "TBD", time: "—" };
	const d = new Date(iso);
	const date = d
		.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "Asia/Tokyo",
		})
		.toUpperCase();
	const time = d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Tokyo",
	});
	return { date, time: `${time} JST` };
}

export const MissionDetailPage: FC<{
	mission: MissionRow;
	site: SiteRow | null;
	target: SiteRow | null;
	crew: ParticipantWithUser[];
	poll: PollWithOptions | null;
	user: SessionUser | null;
	aboard: boolean;
	googleEnabled: boolean;
}> = ({ mission, site, target, crew, poll, user, aboard, googleEnabled }) => {
	const isCreator = user?.id === mission.created_by;
	const isCommander = crew.some((c) => c.user_id === user?.id && c.role === "commander");
	const canEdit = isCreator;
	const isActive = !["completed", "scrubbed"].includes(mission.status);
	const template = getTemplate(mission.template_id);
	const launch = formatLaunchDate(mission.scheduled_at);
	const heroImage = pickHeroImage(mission, site, target, { googleEnabled });
	// If the mission has an FK but the viewer can't access that site,
	// `site` is null here. Fall back to the denormalized text only when
	// no FK is set (free-text entry) so hidden site names don't leak.
	const launchSiteLabel =
		site?.name ?? (mission.launch_site_id ? "—" : (mission.launch_site ?? "—"));
	const targetLabel = target?.name ?? (mission.target_id ? "—" : (mission.target_orbit ?? "—"));

	return (
		<div>
			<Header user={user} />

			<MissionHero
				mission={mission}
				image={heroImage}
				eyebrow={`${template?.name ?? mission.template_id} Mission`}
			/>

			<main class="max-w-[1600px] mx-auto px-6 md:px-12 py-16 md:py-20 space-y-24">
				{/* MISSION DETAILS */}
				<section class="reveal-on-scroll">
					<h2 class="section-head text-space-white mb-8">MISSION DETAILS</h2>
					<dl class="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 border-t border-white/[0.06] pt-8">
						<div>
							<dt class="eyebrow mb-3">Launch Date</dt>
							<dd class="font-mono text-sm text-space-100">{launch.date}</dd>
						</div>
						<div>
							<dt class="eyebrow mb-3">Launch Time</dt>
							<dd class="font-mono text-sm text-space-100 tabular">{launch.time}</dd>
						</div>
						<div>
							<dt class="eyebrow mb-3">Launch Site</dt>
							<dd class="font-mono text-sm text-space-100">
								{site ? (
									<a href={`/sites/${site.slug}`} class="hover:text-launch-cyan tx-btn">
										{launchSiteLabel}
									</a>
								) : (
									launchSiteLabel
								)}
							</dd>
						</div>
						<div>
							<dt class="eyebrow mb-3">Target</dt>
							<dd class="font-mono text-sm text-space-100">
								{target ? (
									<a href={`/sites/${target.slug}`} class="hover:text-launch-cyan tx-btn">
										{targetLabel}
									</a>
								) : (
									targetLabel
								)}
							</dd>
						</div>
						{mission.vehicle && (
							<div>
								<dt class="eyebrow mb-3">Vehicle</dt>
								<dd class="font-mono text-sm text-space-100">{mission.vehicle}</dd>
							</div>
						)}
						<div>
							<dt class="eyebrow mb-3">Visibility</dt>
							<dd class="font-mono text-sm text-space-100 capitalize">{mission.visibility}</dd>
						</div>
						<div>
							<dt class="eyebrow mb-3">Designation</dt>
							<dd class="font-mono text-sm text-space-100">
								{mission.callsign} · seq {mission.seq}
							</dd>
						</div>
					</dl>
				</section>

				{/* MISSION BRIEF */}
				{mission.description && (
					<section class="reveal-on-scroll">
						<h2 class="section-head text-space-white mb-8">MISSION BRIEF</h2>
						<p class="text-space-200 leading-relaxed max-w-3xl text-base md:text-lg">
							{mission.description}
						</p>
					</section>
				)}

				{/* COUNTDOWN timeline */}
				<CountdownTimeline events={defaultTimeline(mission.template_id)} />

				{/* FLIGHT OPERATIONS */}
				{user && isActive && (
					<section class="reveal-on-scroll">
						<h2 class="section-head text-space-white mb-8">FLIGHT OPERATIONS</h2>
						<div class="flex flex-wrap gap-3">
							{!aboard ? (
								<form method="post" action={`/missions/${mission.external_id}/board`}>
									<button
										type="submit"
										class="group inline-flex items-center gap-2 px-6 py-2.5 bg-launch-green/10 hover:bg-launch-green/20 border border-launch-green/40 text-launch-green font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
									>
										<span class="w-1.5 h-1.5 rounded-full bg-launch-green animate-pulse" />
										Board Mission
									</button>
								</form>
							) : !isCreator ? (
								<form method="post" action={`/missions/${mission.external_id}/abort`}>
									<button
										type="submit"
										class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-launch-red/10 border border-launch-red/40 text-launch-red font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
									>
										Abort
									</button>
								</form>
							) : null}
							{canEdit && (
								<>
									<a
										href={`/missions/${mission.external_id}/edit`}
										class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-white/5 border border-white/20 text-space-100 font-bold text-[12px] uppercase tracking-[1.17px] tx-btn"
									>
										Edit
									</a>
									<form method="post" action={`/missions/${mission.external_id}/scrub`}>
										<button
											type="submit"
											class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-launch-red/10 border border-launch-red/30 text-launch-red/80 hover:text-launch-red font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
										>
											Scrub Mission
										</button>
									</form>
								</>
							)}
						</div>
					</section>
				)}

				{/* CREW MANIFEST */}
				<section class="reveal-on-scroll">
					<CrewList crew={crew} />
				</section>

				{/* SCHEDULE POLL */}
				{poll ? (
					<section class="reveal-on-scroll">
						<PollGrid
							poll={poll}
							missionExternalId={mission.external_id}
							user={user}
							isCommander={isCommander}
						/>
					</section>
				) : user && isCommander && mission.status === "planning" ? (
					<section class="reveal-on-scroll">
						<h2 class="section-head text-space-white mb-8">LAUNCH WINDOW NEGOTIATION</h2>
						<details class="border border-white/10 p-5">
							<summary class="font-bold text-[12px] uppercase tracking-[1.17px] text-launch-cyan cursor-pointer">
								+ Create Schedule Poll
							</summary>
							<form
								method="post"
								action={`/missions/${mission.external_id}/poll`}
								class="mt-5 space-y-4"
							>
								<div>
									<label class="eyebrow block mb-2">Poll Title</label>
									<input
										type="text"
										name="poll_title"
										value="Launch Window Poll"
										class="w-full bg-space-900 border border-white/10 px-3 py-2 text-sm text-space-100 focus:border-launch-cyan focus:outline-none font-mono"
									/>
								</div>
								<div>
									<label class="eyebrow block mb-2">Time Options</label>
									<div class="space-y-2">
										{[0, 1, 2].map((i) => (
											<div key={i} class="flex gap-2">
												<input
													type="datetime-local"
													name="starts_at[]"
													class="flex-1 bg-space-900 border border-white/10 px-3 py-2 text-sm text-space-100 focus:border-launch-cyan focus:outline-none font-mono"
												/>
												<input
													type="datetime-local"
													name="ends_at[]"
													class="flex-1 bg-space-900 border border-white/10 px-3 py-2 text-sm text-space-100 focus:border-launch-cyan focus:outline-none font-mono"
												/>
											</div>
										))}
									</div>
								</div>
								<button
									type="submit"
									class="px-6 py-2.5 border border-launch-cyan/50 text-launch-cyan font-bold text-[12px] uppercase tracking-[1.17px] hover:bg-launch-cyan/10 tx-btn cursor-pointer"
								>
									Create Poll
								</button>
							</form>
						</details>
					</section>
				) : null}
			</main>

			<Footer heroCredit={heroImage?.credit ?? null} />
		</div>
	);
};
