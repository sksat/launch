import type { FC } from "hono/jsx";
import type { MissionRow } from "../../types";

const statusStyles: Record<MissionRow["status"], { dot: string; text: string; label: string }> = {
	planning: {
		dot: "bg-space-500",
		text: "text-space-400",
		label: "Planning",
	},
	scheduled: {
		dot: "bg-launch-cyan",
		text: "text-launch-cyan",
		label: "Scheduled",
	},
	go: {
		dot: "bg-launch-green animate-pulse",
		text: "text-launch-green",
		label: "Go for Launch",
	},
	completed: {
		dot: "bg-space-500",
		text: "text-space-400",
		label: "Nominal",
	},
	scrubbed: {
		dot: "bg-launch-red",
		text: "text-launch-red",
		label: "Scrubbed",
	},
};

export const StatusBadge: FC<{ status: MissionRow["status"]; size?: "sm" | "md" }> = ({
	status,
	size = "sm",
}) => {
	const s = statusStyles[status];
	const sizing =
		size === "md" ? "text-[11px] tracking-[0.25em] gap-2.5" : "text-[10px] tracking-[0.22em] gap-2";
	const dotSize = size === "md" ? "w-1.5 h-1.5" : "w-1 h-1";
	return (
		<span class={`inline-flex items-center font-mono uppercase ${sizing} ${s.text}`}>
			<span class={`${dotSize} rounded-full ${s.dot}`} />
			{s.label}
		</span>
	);
};
