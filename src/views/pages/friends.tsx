import type { FC } from "hono/jsx";
import type { PendingRequestWithUser } from "../../db/friendships";
import type { SessionUser, UserRow } from "../../types";
import { Header } from "../components/header";

type Flash = { kind: "ok" | "err"; text: string } | null;

export const FriendsPage: FC<{
	user: SessionUser;
	friends: UserRow[];
	incoming: PendingRequestWithUser[];
	outgoing: PendingRequestWithUser[];
	flash?: Flash;
}> = ({ user, friends, incoming, outgoing, flash = null }) => {
	return (
		<div>
			<Header user={user} />

			<main class="max-w-3xl mx-auto px-4 py-12">
				<h1 class="text-2xl font-bold tracking-wider text-space-white uppercase mb-8">Friends</h1>

				{flash && (
					<div
						class={`mb-6 px-4 py-3 rounded border text-sm ${
							flash.kind === "ok"
								? "border-launch-green/40 bg-launch-green/5 text-launch-green"
								: "border-launch-red/40 bg-launch-red/5 text-launch-red"
						}`}
					>
						{flash.text}
					</div>
				)}

				<section class="mb-10">
					<h2 class="text-xs text-space-500 uppercase tracking-wider mb-3">Send Friend Request</h2>
					<form method="post" action="/friends/requests" class="flex flex-col sm:flex-row gap-2">
						<input
							type="text"
							name="login"
							required
							placeholder="GitHub login (e.g. octocat)"
							class="flex-1 bg-space-900 border border-space-700 rounded px-3 py-2 text-sm font-mono text-space-200 placeholder:text-space-600 focus:border-launch-cyan focus:outline-none"
						/>
						<button
							type="submit"
							class="px-4 py-2 bg-launch-blue text-space-white text-sm uppercase tracking-wider rounded hover:bg-launch-cyan transition-colors"
						>
							Send
						</button>
					</form>
				</section>

				{incoming.length > 0 && (
					<section class="mb-10">
						<h2 class="text-xs text-space-500 uppercase tracking-wider mb-3">
							Incoming Requests ({incoming.length})
						</h2>
						<ul class="space-y-2">
							{incoming.map((r) => (
								<li
									key={`in-${r.requester_id}`}
									class="flex items-center gap-3 p-3 border border-space-700 rounded"
								>
									<img
										src={r.other_avatar_url}
										alt={r.other_login}
										width={40}
										height={40}
										class="w-10 h-10 rounded-full"
									/>
									<div class="flex-1 min-w-0">
										<div class="text-sm text-space-200">{r.other_display_name}</div>
										<div class="font-mono text-[11px] text-space-500">@{r.other_login}</div>
									</div>
									<form method="post" action={`/friends/requests/${r.requester_id}/accept`}>
										<button
											type="submit"
											class="px-3 py-1.5 bg-launch-green/15 border border-launch-green/40 text-launch-green text-xs uppercase tracking-wider rounded hover:bg-launch-green/25"
										>
											Accept
										</button>
									</form>
									<form method="post" action={`/friends/requests/${r.requester_id}/decline`}>
										<button
											type="submit"
											class="px-3 py-1.5 bg-space-800 border border-space-700 text-space-400 text-xs uppercase tracking-wider rounded hover:text-space-200"
										>
											Decline
										</button>
									</form>
								</li>
							))}
						</ul>
					</section>
				)}

				{outgoing.length > 0 && (
					<section class="mb-10">
						<h2 class="text-xs text-space-500 uppercase tracking-wider mb-3">
							Outgoing Requests ({outgoing.length})
						</h2>
						<ul class="space-y-2">
							{outgoing.map((r) => (
								<li
									key={`out-${r.addressee_id}`}
									class="flex items-center gap-3 p-3 border border-space-700 rounded"
								>
									<img
										src={r.other_avatar_url}
										alt={r.other_login}
										width={40}
										height={40}
										class="w-10 h-10 rounded-full"
									/>
									<div class="flex-1 min-w-0">
										<div class="text-sm text-space-200">{r.other_display_name}</div>
										<div class="font-mono text-[11px] text-space-500">@{r.other_login}</div>
									</div>
									<span class="font-mono text-[10px] uppercase tracking-wider text-space-500">
										Pending
									</span>
									<form method="post" action={`/friends/requests/${r.addressee_id}/withdraw`}>
										<button
											type="submit"
											class="px-3 py-1.5 bg-space-800 border border-space-700 text-space-400 text-xs uppercase tracking-wider rounded hover:text-space-200"
										>
											Withdraw
										</button>
									</form>
								</li>
							))}
						</ul>
					</section>
				)}

				<section>
					<h2 class="text-xs text-space-500 uppercase tracking-wider mb-3">
						Friends ({friends.length})
					</h2>
					{friends.length === 0 ? (
						<p class="text-sm text-space-500">
							No friends yet. Send a request above using a GitHub login.
						</p>
					) : (
						<ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{friends.map((f) => (
								<li key={f.id} class="flex items-center gap-3 p-3 border border-space-700 rounded">
									<img
										src={f.avatar_url}
										alt={f.login}
										width={40}
										height={40}
										class="w-10 h-10 rounded-full"
									/>
									<div class="flex-1 min-w-0">
										<div class="text-sm text-space-200 truncate">{f.display_name}</div>
										<div class="font-mono text-[11px] text-space-500">@{f.login}</div>
									</div>
									<form method="post" action={`/friends/${f.id}/remove`}>
										<button
											type="submit"
											class="px-3 py-1.5 bg-space-800 border border-space-700 text-space-400 text-xs uppercase tracking-wider rounded hover:text-launch-red hover:border-launch-red/40"
										>
											Remove
										</button>
									</form>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
};
