import type { FC } from "hono/jsx";
import { isoToJstDatetimeLocal } from "../../lib/datetime";
import type { MissionTemplate } from "../../lib/templates";
import type { MissionRow, SessionUser, SiteRow, UserRow } from "../../types";
import { Header } from "../components/header";

export const MissionFormPage: FC<{
	templates: MissionTemplate[];
	sites: SiteRow[];
	user: SessionUser;
	mission?: MissionRow;
	friends?: UserRow[];
	preBoardedIds?: number[];
}> = ({ templates, sites, user, mission, friends = [], preBoardedIds = [] }) => {
	const preBoardedSet = new Set(preBoardedIds);
	const isEdit = !!mission;
	const currentTemplate = mission
		? templates.find((t) => t.id === mission.template_id)
		: templates[0];

	return (
		<div>
			<Header user={user} />

			<main class="max-w-2xl mx-auto px-4 py-12">
				<h1 class="text-2xl font-bold tracking-wider text-space-white uppercase mb-8">
					{isEdit ? "Edit Mission" : "New Mission"}
				</h1>

				<form
					method="post"
					action={isEdit ? `/missions/${mission?.external_id}/edit` : "/missions"}
					class="space-y-6 mission-form"
					data-template={currentTemplate?.id}
				>
					{/* Template selector (only for new) */}
					{!isEdit && (
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-2">
								Mission Type
							</label>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
								{templates.map((t) => (
									<label
										key={t.id}
										class="flex flex-col items-center p-4 border border-space-700 rounded-lg cursor-pointer hover:border-space-500 transition-colors has-[:checked]:border-launch-cyan has-[:checked]:bg-launch-cyan/5"
									>
										<input
											type="radio"
											name="template_id"
											value={t.id}
											checked={t.id === currentTemplate?.id}
											class="sr-only"
										/>
										<span class="text-lg font-bold text-space-200 tracking-wider mb-1">
											{t.code}
										</span>
										<span class="text-xs text-space-500 uppercase">{t.name}</span>
									</label>
								))}
							</div>
						</div>
					)}

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">Title</label>
						<input
							type="text"
							name="title"
							value={mission?.title ?? ""}
							placeholder="Optional mission title"
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							Description
						</label>
						<textarea
							name="description"
							rows={3}
							placeholder="Mission brief"
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none resize-y"
						>
							{mission?.description ?? ""}
						</textarea>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							Scheduled Date/Time
						</label>
						<input
							type="datetime-local"
							name="scheduled_at"
							value={isoToJstDatetimeLocal(mission?.scheduled_at)}
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:border-launch-cyan focus:outline-none"
						/>
					</div>

					<div class="mission-form-sitegrid grid grid-cols-2 gap-4">
						<div class="mission-form-launch-site">
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
								{currentTemplate?.fields.launch_site?.label ?? "Launch Site"}
							</label>
							<select
								name="launch_site_id"
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:border-launch-cyan focus:outline-none mb-2"
							>
								<option value="">— Free text below —</option>
								{sites.map((s) => (
									<option key={s.id} value={s.id} selected={mission?.launch_site_id === s.id}>
										{s.name}
										{s.is_default === 1 ? " (default)" : ""}
									</option>
								))}
							</select>
							<input
								type="text"
								name="launch_site"
								value={mission?.launch_site ?? ""}
								placeholder={currentTemplate?.fields.launch_site?.placeholder ?? ""}
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
							/>
							<p class="mt-1 text-[11px] text-space-600">
								Select a registered site or type freely.{" "}
								<a href="/sites/new" class="text-launch-cyan hover:underline">
									+ Register new site
								</a>
							</p>
						</div>
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
								{currentTemplate?.fields.target_orbit?.label ?? "Target"}
							</label>
							<select
								name="target_id"
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 focus:border-launch-cyan focus:outline-none mb-2"
							>
								<option value="">— Free text below —</option>
								{sites.map((s) => (
									<option key={s.id} value={s.id} selected={mission?.target_id === s.id}>
										{s.name}
										{s.is_default === 1 ? " (default)" : ""}
									</option>
								))}
							</select>
							<input
								type="text"
								name="target_orbit"
								value={mission?.target_orbit ?? ""}
								placeholder={currentTemplate?.fields.target_orbit?.placeholder ?? ""}
								class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
							/>
							<p class="mt-1 text-[11px] text-space-600">
								Select a registered site or type freely.{" "}
								<a href="/sites/new" class="text-launch-cyan hover:underline">
									+ Register new site
								</a>
							</p>
						</div>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-1">
							{currentTemplate?.fields.vehicle?.label ?? "Vehicle"}
						</label>
						<input
							type="text"
							name="vehicle"
							value={mission?.vehicle ?? ""}
							placeholder={currentTemplate?.fields.vehicle?.placeholder ?? ""}
							class="w-full bg-space-900 border border-space-700 rounded px-3 py-2 text-sm text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
					</div>

					<div>
						<label class="block text-xs text-space-500 uppercase tracking-wider mb-2">
							Visibility
						</label>
						<div class="flex flex-wrap gap-3">
							{(["public", "authenticated", "friends", "participants"] as const).map((v) => (
								<label
									key={v}
									class="flex items-center gap-2 px-3 py-2 border border-space-700 rounded cursor-pointer hover:border-space-500 transition-colors has-[:checked]:border-launch-cyan has-[:checked]:bg-launch-cyan/5"
								>
									<input
										type="radio"
										name="visibility"
										value={v}
										checked={
											mission ? mission.visibility === v : currentTemplate?.default_visibility === v
										}
										class="accent-launch-cyan"
									/>
									<span class="text-xs text-space-300 uppercase tracking-wider">
										{v === "participants" ? "Crew Only" : v}
									</span>
								</label>
							))}
						</div>
					</div>

					{!isEdit && friends.length > 0 && (
						<div>
							<label class="block text-xs text-space-500 uppercase tracking-wider mb-2">
								Pre-board Crew
							</label>
							<p class="text-[11px] text-space-600 mb-2">
								Select friends to auto-board as crew on creation. Skip to let them board themselves.
							</p>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{friends.map((f) => (
									<label
										key={f.id}
										class="flex items-center gap-2 p-2 border border-space-700 rounded cursor-pointer hover:border-space-500 transition-colors has-[:checked]:border-launch-cyan has-[:checked]:bg-launch-cyan/5"
									>
										<input
											type="checkbox"
											name="crew_ids"
											value={f.id}
											defaultChecked={preBoardedSet.has(f.id)}
											class="accent-launch-cyan"
										/>
										<img
											src={f.avatar_url}
											alt={f.login}
											width={24}
											height={24}
											class="w-6 h-6 rounded-full"
										/>
										<span class="text-xs text-space-300 truncate">{f.display_name}</span>
										<span class="font-mono text-[10px] text-space-500 ml-auto">@{f.login}</span>
									</label>
								))}
							</div>
						</div>
					)}

					<div class="flex gap-3 pt-4">
						<button
							type="submit"
							class="px-6 py-2 bg-launch-blue text-space-white text-sm uppercase tracking-wider rounded hover:bg-launch-cyan transition-colors"
						>
							{isEdit ? "Update Mission" : "Create Mission"}
						</button>
						<a
							href={isEdit ? `/missions/${mission?.external_id}` : "/missions"}
							class="px-6 py-2 bg-space-800 text-space-400 text-sm uppercase tracking-wider rounded border border-space-700 hover:text-space-200 transition-colors"
						>
							Cancel
						</a>
					</div>
				</form>
				{/* On the new-mission form, keep the visibility radio in sync
				    with the chosen template's default. Without this, switching
				    templates leaves the initial default checked, so e.g. SPEC's
				    `public` default is unreachable unless the user also flips
				    the visibility radio manually. Skipped on edit — there the
				    existing mission.visibility is authoritative. */}
				{!isEdit && (
					<script
						dangerouslySetInnerHTML={{
							__html: `
(function(){
  var defaults = ${JSON.stringify(
		Object.fromEntries(templates.map((t) => [t.id, t.default_visibility])),
	)};
  var userTouchedVisibility = false;
  var form = document.querySelector('.mission-form');
  if (!form) return;
  form.addEventListener('change', function(e){
    var t = e.target;
    if (!t || !t.name) return;
    if (t.name === 'visibility') { userTouchedVisibility = true; return; }
    if (t.name === 'template_id' && !userTouchedVisibility) {
      var want = defaults[t.value];
      if (!want) return;
      var radio = form.querySelector('input[name="visibility"][value="' + want + '"]');
      if (radio) radio.checked = true;
    }
  });
})();
`,
						}}
					/>
				)}
			</main>
		</div>
	);
};
