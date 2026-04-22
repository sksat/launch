import type { FC } from "hono/jsx";
import { resolveSiteImageUrl } from "../../lib/site-image";
import type { SessionUser, SiteRow } from "../../types";
import { Footer } from "../components/footer";
import { Header } from "../components/header";

export const SiteDetailPage: FC<{
	site: SiteRow;
	user: SessionUser | null;
	googleEnabled: boolean;
}> = ({ site, user, googleEnabled }) => {
	const canEdit = user?.id === site.created_by && site.is_default !== 1;
	const image = resolveSiteImageUrl(site, { googleEnabled });
	const googleUnavailable = site.image_source === "google_places" && !googleEnabled;
	const gmapsUrl =
		site.latitude !== null && site.longitude !== null
			? `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`
			: null;

	return (
		<div>
			<Header user={user} />

			<section
				class="relative w-full overflow-hidden bg-black -mt-[74px]"
				style="height: 70vh; min-height: 460px;"
			>
				{image ? (
					<>
						<img
							src={image}
							alt={site.name}
							class="absolute inset-0 w-full h-full object-cover reveal-fade"
							style="object-position: 50% 40%;"
						/>
						<div
							class="absolute inset-0 pointer-events-none"
							style="background: linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.10) 25%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.92) 100%);"
						/>
					</>
				) : (
					<div class="starfield" aria-hidden="true" />
				)}

				<div class="absolute bottom-0 left-0 right-0 px-6 md:px-12 pb-10 md:pb-14">
					<div class="max-w-[1600px] mx-auto">
						<div class="reveal-subheader eyebrow text-launch-cyan mb-3">
							Site{site.is_default === 1 ? " · Default" : ""}
						</div>
						<div class="reveal-header">
							<h1 class="hero-title text-space-white text-[40px] sm:text-[64px] md:text-[88px] lg:text-[112px]">
								{site.name}
							</h1>
						</div>
						{site.image_source === "google_places" && site.google_attribution && (
							<div class="reveal-subheader mt-3 font-mono text-[11px] text-space-300 uppercase tracking-wider">
								Photo © {site.google_attribution} via Google
							</div>
						)}
						{googleUnavailable && (
							<div class="reveal-subheader mt-3 font-mono text-[11px] text-space-500 uppercase tracking-wider">
								Google photo unavailable — API key not configured
							</div>
						)}
					</div>
				</div>
			</section>

			<main class="max-w-[1600px] mx-auto px-6 md:px-12 py-16 md:py-20 space-y-20">
				<section class="reveal-on-scroll">
					<h2 class="section-head text-space-white mb-8">SITE DETAILS</h2>
					<dl class="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 border-t border-white/[0.06] pt-8">
						<div>
							<dt class="eyebrow mb-3">Slug</dt>
							<dd class="font-mono text-sm text-space-100">{site.slug}</dd>
						</div>
						<div>
							<dt class="eyebrow mb-3">Visibility</dt>
							<dd class="font-mono text-sm text-space-100 capitalize">{site.visibility}</dd>
						</div>
						{site.address && (
							<div class="col-span-2">
								<dt class="eyebrow mb-3">Address</dt>
								<dd class="font-mono text-sm text-space-100">{site.address}</dd>
							</div>
						)}
						{site.latitude !== null && site.longitude !== null && (
							<div class="col-span-2">
								<dt class="eyebrow mb-3">Coordinates</dt>
								<dd class="font-mono text-sm text-space-100 tabular">
									{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
									{gmapsUrl && (
										<>
											{" · "}
											<a
												href={gmapsUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-launch-cyan hover:underline"
											>
												Open in Google Maps
											</a>
										</>
									)}
								</dd>
							</div>
						)}
					</dl>
					{site.description && (
						<p class="text-space-200 leading-relaxed max-w-3xl text-base md:text-lg mt-10">
							{site.description}
						</p>
					)}
				</section>

				{canEdit && (
					<section class="reveal-on-scroll">
						<h2 class="section-head text-space-white mb-8">SITE OPERATIONS</h2>
						<div class="flex flex-wrap gap-3">
							<a
								href={`/sites/${site.slug}/edit`}
								class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-white/5 border border-white/20 text-space-100 font-bold text-[12px] uppercase tracking-[1.17px] tx-btn"
							>
								Edit
							</a>
							<form
								method="post"
								action={`/sites/${site.slug}/image`}
								encType="multipart/form-data"
								class="inline-flex items-center gap-2"
							>
								<input
									type="file"
									name="image"
									accept="image/jpeg,image/png,image/webp"
									class="text-[12px] text-space-300 file:mr-3 file:px-3 file:py-1.5 file:border file:border-white/20 file:bg-transparent file:text-space-100 file:uppercase file:tracking-wider file:text-[11px] file:cursor-pointer"
								/>
								<button
									type="submit"
									class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-launch-cyan/10 border border-launch-cyan/40 text-launch-cyan font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
								>
									Upload Image
								</button>
							</form>
							{googleEnabled && (
								<form method="post" action={`/sites/${site.slug}/fetch-google-photo`}>
									<button
										type="submit"
										class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-white/5 border border-white/20 text-space-100 font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
									>
										Auto-fetch from Google
									</button>
								</form>
							)}
							<form
								method="post"
								action={`/sites/${site.slug}/delete`}
								onsubmit="return confirm('Delete this site? This cannot be undone.')"
							>
								<button
									type="submit"
									class="inline-flex items-center px-6 py-2.5 bg-transparent hover:bg-launch-red/10 border border-launch-red/30 text-launch-red/80 hover:text-launch-red font-bold text-[12px] uppercase tracking-[1.17px] tx-btn cursor-pointer"
								>
									Delete
								</button>
							</form>
						</div>
					</section>
				)}
			</main>

			<Footer heroCredit={null} />
		</div>
	);
};
