import type { FC } from "hono/jsx";
import { resolveSiteImageUrl } from "../../lib/site-image";
import type { SessionUser, SiteRow } from "../../types";
import { Header } from "../components/header";

export const SiteListPage: FC<{
	sites: SiteRow[];
	user: SessionUser | null;
	googleEnabled: boolean;
}> = ({ sites, user, googleEnabled }) => (
	<div>
		<Header user={user} />

		<main class="max-w-6xl mx-auto px-4 py-12">
			<div class="flex items-center justify-between mb-8">
				<h1 class="text-2xl font-bold tracking-wider text-space-white uppercase">Sites</h1>
				{user && (
					<a
						href="/sites/new"
						class="px-4 py-2 bg-launch-blue text-space-white text-sm uppercase tracking-wider rounded hover:bg-launch-cyan transition-colors"
					>
						New Site
					</a>
				)}
			</div>

			{sites.length === 0 ? (
				<div class="text-center py-16 border border-space-800 rounded-lg">
					<p class="text-space-500">No sites registered yet.</p>
				</div>
			) : (
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{sites.map((s) => {
						const thumb = resolveSiteImageUrl(s, { googleEnabled });
						const googleWithoutImage = s.image_source === "google_places" && !googleEnabled;
						return (
							<a
								key={s.id}
								href={`/sites/${s.slug}`}
								class="group block border border-white/[0.08] hover:border-launch-cyan/60 rounded-lg overflow-hidden tx-btn bg-space-900/30"
							>
								<div class="aspect-[16/9] bg-space-900 relative overflow-hidden">
									{thumb ? (
										<img
											src={thumb}
											alt={s.name}
											class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 tx-btn"
										/>
									) : (
										<div class="absolute inset-0 flex items-center justify-center">
											<span class="font-mono text-[11px] text-space-600 uppercase tracking-wider">
												{googleWithoutImage ? "Google photo unavailable" : "No image"}
											</span>
										</div>
									)}
									{s.is_default === 1 && (
										<span class="absolute top-2 left-2 px-2 py-0.5 bg-launch-cyan/20 border border-launch-cyan/50 text-launch-cyan text-[10px] font-bold uppercase tracking-wider rounded">
											Default
										</span>
									)}
								</div>
								<div class="p-4">
									<div class="font-bold text-[15px] text-space-100 group-hover:text-launch-cyan tx-btn truncate">
										{s.name}
									</div>
									{s.description && (
										<div class="mt-1 text-[12px] text-space-500 line-clamp-2">{s.description}</div>
									)}
									<div class="mt-3 flex items-center justify-between">
										<span class="font-mono text-[10px] text-space-600 uppercase tracking-wider">
											{s.visibility}
										</span>
										{s.image_source === "google_places" && s.google_attribution && (
											<span
												class="font-mono text-[10px] text-space-600 truncate max-w-[60%]"
												title={`Photo: ${s.google_attribution} via Google`}
											>
												© {s.google_attribution} / Google
											</span>
										)}
									</div>
								</div>
							</a>
						);
					})}
				</div>
			)}
		</main>
	</div>
);
