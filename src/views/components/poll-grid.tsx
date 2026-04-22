import type { FC } from "hono/jsx";
import type { PollWithOptions } from "../../db/polls";
import type { SessionUser } from "../../types";

function formatSlot(iso: string): string {
	// The app renders all times in JST (CLAUDE.md); without the timezone
	// pin, Workers (UTC runtime) would show poll slots 9h off.
	const d = new Date(iso);
	const date = d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "Asia/Tokyo",
	});
	const time = d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Tokyo",
	});
	return `${date} · ${time} JST`;
}

const availabilityIcon: Record<string, string> = {
	available: "O",
	maybe: "?",
	unavailable: "X",
};

const availabilityStyle: Record<string, string> = {
	available: "text-launch-green",
	maybe: "text-launch-amber",
	unavailable: "text-launch-red",
};

export const PollGrid: FC<{
	poll: PollWithOptions;
	// URL-addressable mission handle (external_id). The integer `id` is
	// never rendered in URLs — form actions below target /missions/<mid>/…
	missionExternalId: string;
	user: SessionUser | null;
	isCommander: boolean;
}> = ({ poll, missionExternalId, user, isCommander }) => {
	// Collect all unique voters
	const voterIds = new Set<number>();
	for (const opt of poll.options) {
		for (const v of opt.votes) {
			voterIds.add(v.user_id);
		}
	}

	return (
		<div>
			<div class="flex items-baseline justify-between border-b border-white/[0.08] pb-3 mb-5">
				<h2 class="section-head text-space-white">LAUNCH WINDOW NEGOTIATION</h2>
				<span class="font-mono text-[10px] uppercase tracking-[0.22em] text-space-500">
					{poll.title}
					{poll.is_closed ? " · Closed" : ""}
				</span>
			</div>

			{!poll.is_closed && user ? (
				<form method="post" action={`/missions/${missionExternalId}/poll/vote`}>
					<div class="overflow-x-auto border border-white/[0.08]">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-white/[0.08] bg-white/[0.02]">
									<th class="text-left eyebrow py-3 px-4">Launch Window</th>
									<th class="text-center eyebrow py-3 px-2">Available</th>
									<th class="text-center eyebrow py-3 px-2">Maybe</th>
									<th class="text-center eyebrow py-3 px-2">Unavailable</th>
								</tr>
							</thead>
							<tbody>
								{poll.options.map((opt) => {
									const myVote = opt.votes.find((v) => v.user_id === user.id);
									const availCount = opt.votes.filter((v) => v.availability === "available").length;
									return (
										<tr key={opt.id} class="border-b border-white/[0.05] last:border-0">
											<td class="py-3 px-4">
												<div class="font-mono text-sm text-space-100 tabular">
													{formatSlot(opt.starts_at)}
												</div>
												<div class="font-mono text-[10px] uppercase tracking-[0.22em] text-launch-green/70 mt-1">
													{availCount} GO
												</div>
											</td>
											{(["available", "maybe", "unavailable"] as const).map((val) => (
												<td key={val} class="text-center py-3 px-2">
													<label class="inline-flex cursor-pointer">
														<input
															type="radio"
															name={`vote_${opt.id}`}
															value={val}
															checked={myVote?.availability === val}
															class="accent-launch-cyan w-4 h-4"
														/>
													</label>
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<button
						type="submit"
						class="mt-5 inline-flex items-center px-6 py-2.5 border border-launch-cyan/50 text-launch-cyan font-mono text-[11px] uppercase tracking-[0.25em] hover:bg-launch-cyan/10 transition-all cursor-pointer"
					>
						Submit Votes
					</button>
				</form>
			) : (
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-space-800">
								<th class="text-left text-xs text-space-500 uppercase tracking-wider py-2 pr-4">
									Window
								</th>
								<th class="text-center text-xs text-space-500 uppercase tracking-wider py-2 px-2">
									Votes
								</th>
							</tr>
						</thead>
						<tbody>
							{poll.options.map((opt) => (
								<tr key={opt.id} class="border-b border-space-800/50">
									<td class="py-2 pr-4 font-mono text-space-300">{formatSlot(opt.starts_at)}</td>
									<td class="text-center py-2 px-2">
										{opt.votes.map((v) => (
											<span
												key={v.user_id}
												class={`inline-block mx-0.5 ${availabilityStyle[v.availability]}`}
												title={`${v.availability}`}
											>
												{availabilityIcon[v.availability]}
											</span>
										))}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{isCommander && !poll.is_closed && (
				<form
					method="post"
					action={`/missions/${missionExternalId}/poll/confirm`}
					class="mt-6 pt-6 border-t border-white/[0.05]"
				>
					<div class="eyebrow mb-3">Commander Action · Lock Launch Window</div>
					<div class="flex flex-wrap items-center gap-3">
						<select
							name="option_id"
							class="bg-space-900 border border-white/10 text-space-100 px-3 py-2 text-sm font-mono focus:border-launch-cyan focus:outline-none"
						>
							{poll.options.map((opt) => (
								<option key={opt.id} value={opt.id}>
									{formatSlot(opt.starts_at)} (
									{opt.votes.filter((v) => v.availability === "available").length} GO)
								</option>
							))}
						</select>
						<button
							type="submit"
							class="inline-flex items-center gap-2 px-6 py-2.5 bg-launch-green/10 hover:bg-launch-green/20 border border-launch-green/40 text-launch-green font-mono text-[11px] uppercase tracking-[0.25em] transition-all cursor-pointer"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-launch-green animate-pulse" />
							Confirm Launch Window
						</button>
					</div>
				</form>
			)}
		</div>
	);
};
