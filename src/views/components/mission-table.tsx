import type { FC } from "hono/jsx";
import { getTemplate } from "../../lib/templates";
import type { MissionRow } from "../../types";
import { StatusBadge } from "./status-badge";

function formatDate(iso: string | null): string {
	if (!iso) return "TBD";
	const d = new Date(iso);
	const dt = d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
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
	return m.seq > 1 ? `${m.callsign} #${m.seq}` : m.callsign;
}

const colHead =
	"text-left font-mono uppercase tracking-[0.18em] text-[10px] font-bold text-space-400 py-4 px-2 first:pl-0";
const cell =
	"py-5 px-2 first:pl-0 text-[13px] text-space-100 align-baseline border-t border-white/[0.06] group-hover:border-launch-cyan/40 tx-btn";

export const MissionTable: FC<{
	missions: MissionRow[];
	showStatus?: boolean;
}> = ({ missions, showStatus = false }) => (
	<div class="overflow-x-auto">
		<table class="w-full">
			<thead>
				<tr>
					<th class={colHead}>Mission</th>
					<th class={colHead}>Type</th>
					<th class={colHead}>Launch Site</th>
					<th class={colHead}>Target</th>
					<th class={`${colHead} text-right`}>Launch Date And Time</th>
					{showStatus && <th class={`${colHead} text-right pr-0`}>Status</th>}
				</tr>
			</thead>
			<tbody>
				{missions.map((m) => (
					<tr key={m.id} class="group">
						<td class={cell}>
							<a href={`/missions/${m.external_id}`} class="block group-hover:text-launch-cyan tx-btn">
								<div class="font-bold uppercase text-[15px] tracking-tight">
									{missionDisplayName(m)}
								</div>
								{m.title && <div class="text-[11px] text-space-500 mt-1">{m.title}</div>}
							</a>
						</td>
						<td class={`${cell} font-mono uppercase text-[12px] text-space-300`}>
							{getTemplate(m.template_id)?.name ?? m.template_id}
						</td>
						<td class={`${cell} font-mono uppercase text-[12px] text-space-300`}>
							{m.launch_site ?? "—"}
						</td>
						<td class={`${cell} font-mono uppercase text-[12px] text-space-300`}>
							{m.target_orbit ?? "—"}
						</td>
						<td class={`${cell} font-mono text-[12px] text-space-200 tabular text-right`}>
							{formatDate(m.scheduled_at)}
						</td>
						{showStatus && (
							<td class={`${cell} text-right pr-0`}>
								<StatusBadge status={m.status} />
							</td>
						)}
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
