import type { FC } from "hono/jsx";
import { parseJstAware } from "../../lib/datetime";
import type { MissionRow } from "../../types";
import { StatusBadge } from "./status-badge";

function formatDate(iso: string | null): string {
	if (!iso) return "TBD";
	const d = parseJstAware(iso);
	const dt = d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		timeZone: "Asia/Tokyo",
	});
	const tm = d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Tokyo",
	});
	return `${dt.toUpperCase()} · ${tm} JST`;
}

function missionDisplayName(m: MissionRow): string {
	if (m.seq > 1) return `${m.callsign} #${m.seq}`;
	return m.callsign;
}

export const MissionCard: FC<{ mission: MissionRow }> = ({ mission }) => (
	<a
		href={`/missions/${mission.external_id}`}
		class="group relative block border-t border-white/[0.06] hover:border-white/30 transition-colors py-6 first:border-t-0"
	>
		<div class="grid grid-cols-12 gap-4 items-baseline">
			<div class="col-span-12 md:col-span-3">
				<div class="font-bold uppercase text-2xl md:text-3xl tracking-tight text-space-white group-hover:text-launch-cyan tx-btn leading-none">
					{missionDisplayName(mission)}
				</div>
				{mission.title && <div class="mt-1.5 text-[13px] text-space-400">{mission.title}</div>}
			</div>
			<div class="col-span-6 md:col-span-3">
				<div class="eyebrow text-[9px] mb-1">Launch Site</div>
				<div class="font-mono text-[12px] text-space-200 truncate">
					{mission.launch_site ?? "—"}
				</div>
			</div>
			<div class="col-span-6 md:col-span-3">
				<div class="eyebrow text-[9px] mb-1">Target</div>
				<div class="font-mono text-[12px] text-space-200 truncate">
					{mission.target_orbit ?? "—"}
				</div>
			</div>
			<div class="col-span-8 md:col-span-2">
				<div class="eyebrow text-[9px] mb-1">Launch Date</div>
				<div class="font-mono text-[12px] text-space-200 tabular">
					{formatDate(mission.scheduled_at)}
				</div>
			</div>
			<div class="col-span-4 md:col-span-1 flex md:justify-end items-center">
				<StatusBadge status={mission.status} />
			</div>
		</div>
	</a>
);
