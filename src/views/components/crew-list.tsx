import type { FC } from "hono/jsx";
import type { ParticipantWithUser } from "../../db/participants";

export const CrewList: FC<{ crew: ParticipantWithUser[] }> = ({ crew }) => (
	<div>
		<div class="flex items-baseline justify-between border-b border-white/[0.08] pb-3 mb-5">
			<h2 class="section-head text-space-white">PAYLOAD MANIFEST</h2>
			<span class="font-mono text-[10px] uppercase tracking-[0.22em] text-space-500">
				{crew.length} {crew.length === 1 ? "Member" : "Members"}
			</span>
		</div>
		{crew.length === 0 ? (
			<p class="text-sm text-space-500 italic">No crew aboard yet.</p>
		) : (
			<div class="divide-y divide-white/[0.05]">
				{crew.map((member) => (
					<div key={member.user_id} class="flex items-center gap-4 py-3">
						<img
							src={member.avatar_url}
							alt={member.login}
							class="w-9 h-9 rounded-full border border-white/10"
						/>
						<div class="flex-1">
							<div class="font-mono text-sm text-space-100">{member.login}</div>
							<div class="font-mono text-[10px] uppercase tracking-[0.22em] text-space-500 mt-0.5">
								{member.role === "commander" ? "Commander" : "Crew"}
							</div>
						</div>
						{member.role === "commander" && (
							<span class="font-mono text-[10px] uppercase tracking-[0.22em] text-launch-amber px-2 py-0.5 border border-launch-amber/30">
								CDR
							</span>
						)}
					</div>
				))}
			</div>
		)}
	</div>
);
