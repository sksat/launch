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
			<div class="flex items-center gap-4">
				<a
					href="https://github.com/sksat/launch"
					target="_blank"
					rel="noopener noreferrer"
					class="text-space-500 hover:text-space-100 tx-btn"
				>
					<span class="sr-only">View source on GitHub</span>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="currentColor"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<title>GitHub</title>
						<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
					</svg>
				</a>
				<span class="font-mono text-[10px] uppercase tracking-[0.25em] text-space-700">© 2026</span>
			</div>
		</div>
	</footer>
);
