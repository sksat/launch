import type { FC } from "hono/jsx";

type Kpi = { value: number | string; label: string };

export const KpiStrip: FC<{ kpis: Kpi[] }> = ({ kpis }) => (
	<div class="flex justify-center md:justify-end gap-12 md:gap-16">
		{kpis.map((k) => (
			<div key={k.label} class="text-right">
				<div class="font-bold tabular text-3xl md:text-4xl text-space-white leading-none">
					{k.value}
				</div>
				<div class="eyebrow mt-2">{k.label}</div>
			</div>
		))}
	</div>
);
