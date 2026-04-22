import type { FC } from "hono/jsx";

export type TimelineEvent = {
	/** Offset from T-0 in seconds. Negative = pre-launch, positive = post-launch */
	offset: number;
	event: string;
};

function formatOffset(sec: number): string {
	const past = sec >= 0;
	const abs = Math.abs(sec);
	const h = Math.floor(abs / 3600);
	const m = Math.floor((abs % 3600) / 60);
	const s = Math.floor(abs % 60);
	const pad = (n: number) => String(n).padStart(2, "0");
	const sign = past ? "+" : "-";
	return `T${sign} ${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const CountdownTimeline: FC<{
	events: TimelineEvent[];
	heading?: string;
}> = ({ events, heading = "COUNTDOWN" }) => {
	const sorted = [...events].sort((a, b) => a.offset - b.offset);
	return (
		<section class="reveal-on-scroll">
			<h2 class="section-head text-space-white mb-8">{heading}</h2>
			<table class="w-full">
				<thead>
					<tr>
						<th class="text-left font-mono uppercase tracking-[0.18em] text-[10px] font-bold text-space-400 py-4 pr-2 first:pl-0 w-48">
							Hr/Min/Sec
						</th>
						<th class="text-left font-mono uppercase tracking-[0.18em] text-[10px] font-bold text-space-400 py-4 px-2">
							Event
						</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((e) => (
						<tr key={`${e.offset}-${e.event}`} class="group">
							<td class="py-5 pr-2 font-mono text-[13px] text-space-200 tabular border-t border-white/[0.06] group-hover:border-launch-cyan/40 tx-btn">
								{formatOffset(e.offset)}
							</td>
							<td class="py-5 px-2 font-mono uppercase text-[12px] tracking-[0.05em] text-space-100 border-t border-white/[0.06] group-hover:border-launch-cyan/40 tx-btn">
								{e.event}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
};

/** Default timelines per template — used when the mission has no custom timeline */
export function defaultTimeline(templateId: string): TimelineEvent[] {
	if (templateId === "rideshare") {
		return [
			{ offset: -30 * 60, event: "Crew assembles at launch site" },
			{ offset: -10 * 60, event: "Vehicle pre-flight checks complete" },
			{ offset: -2 * 60, event: "Final crew confirmation" },
			{ offset: 0, event: "Departure" },
			{ offset: 60 * 60, event: "Estimated arrival at target orbit" },
			{ offset: 9 * 60 * 60, event: "Booster recovery (return ride)" },
		];
	}
	if (templateId === "refueling") {
		return [
			{ offset: -15 * 60, event: "Crew assembles at meeting point" },
			{ offset: -5 * 60, event: "Reservation confirmed" },
			{ offset: 0, event: "Departure for restaurant" },
			{ offset: 60 * 60, event: "Refueling complete · return" },
		];
	}
	return [
		{ offset: -30 * 60, event: "Crew assembles" },
		{ offset: -5 * 60, event: "Final go-no-go poll" },
		{ offset: 0, event: "Mission start" },
	];
}
