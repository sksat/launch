import type { FC } from "hono/jsx";
import type { HeroImage } from "../../lib/hero-image";

export const Footer: FC<{ heroCredit?: HeroImage["credit"] | null }> = ({ heroCredit }) => (
	<footer class="border-t border-white/[0.06] mt-12">
		<div class="max-w-[1600px] mx-auto px-6 md:px-12 py-6 flex flex-wrap items-center justify-between gap-3">
			<a
				href="/"
				class="font-mono text-[10px] uppercase tracking-[0.25em] text-space-500 hover:text-space-100 tx-btn"
			>
				launch.sksat.dev
			</a>
			{heroCredit && (
				<span class="text-[10px] text-space-600">
					Hero image:{" "}
					<a
						href={heroCredit.source}
						target="_blank"
						rel="noopener noreferrer"
						class="text-space-500 hover:text-space-300 underline-offset-2 hover:underline"
					>
						{heroCredit.author}
					</a>{" "}
					· {heroCredit.license}
				</span>
			)}
			<span class="font-mono text-[10px] uppercase tracking-[0.25em] text-space-700">© 2026</span>
		</div>
	</footer>
);
