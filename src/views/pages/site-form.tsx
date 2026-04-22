import type { FC } from "hono/jsx";
import type { SessionUser, SiteRow } from "../../types";
import { Header } from "../components/header";

export const SiteFormPage: FC<{
	user: SessionUser;
	site?: SiteRow;
	googleEnabled?: boolean;
}> = ({ user, site, googleEnabled = false }) => {
	const isEdit = !!site;

	return (
		<div>
			<Header user={user} />

			<main class="max-w-2xl mx-auto px-4 py-12">
				<h1 class="text-2xl font-bold tracking-wider text-space-white uppercase mb-8">
					{isEdit ? "Edit Site" : "New Site"}
				</h1>

				<form
					method="post"
					action={isEdit ? `/sites/${site?.slug}/edit` : "/sites"}
					class="space-y-6"
				>
					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">Name</label>
						<input
							type="text"
							name="name"
							value={site?.name ?? ""}
							required
							placeholder="例: カレーうどん ZEYO."
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
					</div>

					{!isEdit && (
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
								Slug (optional)
							</label>
							<input
								type="text"
								name="slug"
								placeholder="auto-derived from name if blank"
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm font-mono text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
							/>
						</div>
					)}

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							Description
						</label>
						<textarea
							name="description"
							rows={3}
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none resize-y"
						>
							{site?.description ?? ""}
						</textarea>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							Address
						</label>
						<input
							type="text"
							name="address"
							value={site?.address ?? ""}
							placeholder="例: 茨城県つくば市..."
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
								Latitude
							</label>
							<input
								type="number"
								step="any"
								name="latitude"
								value={site?.latitude ?? ""}
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm font-mono text-space-200 focus:border-launch-cyan focus:outline-none"
							/>
						</div>
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
								Longitude
							</label>
							<input
								type="number"
								step="any"
								name="longitude"
								value={site?.longitude ?? ""}
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm font-mono text-space-200 focus:border-launch-cyan focus:outline-none"
							/>
						</div>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							Image URL
						</label>
						<input
							type="url"
							name="image_url"
							value={site?.image_source === "url" ? (site.image_url ?? "") : ""}
							placeholder="https://... (leave blank to upload later or use auto-fetch)"
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm font-mono text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
						{isEdit && site?.image_source && site?.image_source !== "url" && (
							<p class="mt-1 text-[11px] text-space-500">
								Current image source:{" "}
								<span class="font-mono text-space-300">{site?.image_source}</span>. To replace, use
								the Upload Image or Auto-fetch buttons on the detail page.
							</p>
						)}
					</div>

					{!isEdit && googleEnabled && (
						<label class="flex items-center gap-2 text-xs text-space-400 uppercase tracking-wider">
							<input type="checkbox" name="auto_fetch" class="accent-launch-cyan" />
							Auto-fetch image from Google (if no URL supplied)
						</label>
					)}

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-2">
							Visibility
						</label>
						<div class="flex gap-3">
							{(["public", "authenticated", "friends", "private"] as const).map((v) => (
								<label
									key={v}
									class="flex items-center gap-2 px-3 py-2 border border-space-700 rounded cursor-pointer hover:border-space-500 transition-colors has-[:checked]:border-launch-cyan has-[:checked]:bg-launch-cyan/5"
								>
									<input
										type="radio"
										name="visibility"
										value={v}
										checked={site ? site.visibility === v : v === "authenticated"}
										class="accent-launch-cyan"
									/>
									<span class="text-xs text-space-300 uppercase tracking-wider">{v}</span>
								</label>
							))}
						</div>
					</div>

					<div class="flex gap-3 pt-4">
						<button
							type="submit"
							class="px-6 py-2 bg-launch-blue text-space-white text-sm uppercase tracking-wider rounded hover:bg-launch-cyan transition-colors"
						>
							{isEdit ? "Update Site" : "Create Site"}
						</button>
						<a
							href={isEdit ? `/sites/${site?.slug}` : "/sites"}
							class="px-6 py-2 bg-space-800 text-space-400 text-sm uppercase tracking-wider rounded border border-space-700 hover:text-space-200 transition-colors"
						>
							Cancel
						</a>
					</div>
				</form>
			</main>
		</div>
	);
};
