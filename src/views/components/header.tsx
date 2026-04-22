import type { FC } from "hono/jsx";
import { useRequestContext } from "hono/jsx-renderer";
import type { AppEnv, MissionRow, SessionUser, UpcomingMissionEntry } from "../../types";

const HEADER_HEIGHT = 74;

function formatLaunchDateJST(iso: string | null): string {
	if (!iso) return "T-?";
	const d = new Date(iso);
	const date = d.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "Asia/Tokyo",
	});
	const time = d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Asia/Tokyo",
	});
	return `${date} · ${time} JST`;
}

function missionDisplayName(m: MissionRow): string {
	return m.seq > 1 ? `${m.callsign} #${m.seq}` : m.callsign;
}

const UpcomingMissionCard: FC<{ entry: UpcomingMissionEntry }> = ({ entry }) => {
	const { mission, thumbnail } = entry;
	return (
		<a
			href={`/missions/${mission.external_id}`}
			class="group flex items-center gap-4 py-3 border-t border-white/[0.12] hover:border-white/40 tx-btn"
		>
			{thumbnail ? (
				<img
					src={thumbnail.src}
					alt={thumbnail.alt}
					width={64}
					height={64}
					loading="lazy"
					class="w-16 h-16 rounded-lg object-cover bg-space-800 flex-shrink-0"
				/>
			) : (
				<div class="w-16 h-16 rounded-lg bg-space-800 flex-shrink-0" />
			)}
			<div class="flex-1 min-w-0">
				<div class="flex items-baseline gap-3 flex-wrap">
					<span class="font-bold text-[15px] uppercase tracking-tight text-space-white group-hover:text-launch-cyan tx-btn">
						{missionDisplayName(mission)}
					</span>
					<span class="text-[15px] text-space-200 truncate">{mission.title || ""}</span>
				</div>
				<div class="mt-1 font-mono text-[12px] text-space-400 tabular">
					{formatLaunchDateJST(mission.scheduled_at)}
				</div>
			</div>
		</a>
	);
};

const UpcomingMissionsWidget: FC<{ entries: UpcomingMissionEntry[] }> = ({ entries }) => {
	if (entries.length === 0) return null;
	return (
		<div class="mt-10">
			<span class="block text-[18px] uppercase tracking-[1.17px] font-normal text-space-white/80 mb-2">
				Upcoming Missions
			</span>
			<div class="flex flex-col">
				{entries.map((e) => (
					<UpcomingMissionCard key={e.mission.id} entry={e} />
				))}
			</div>
			<div class="mt-4 flex justify-end border-t border-white/[0.12] pt-3">
				<a
					href="/missions"
					class="font-bold text-[12px] uppercase tracking-[1.17px] text-space-300 hover:text-space-white tx-btn"
				>
					All Upcoming Missions →
				</a>
			</div>
		</div>
	);
};

function readUpcomingFromRequest(): UpcomingMissionEntry[] {
	try {
		const c = useRequestContext<AppEnv>();
		return c?.var.upcomingMissions ?? [];
	} catch {
		// Outside a request context (e.g., unit tests rendering Header directly).
		return [];
	}
}

export const Header: FC<{
	user: SessionUser | null;
	upcomingMissions?: UpcomingMissionEntry[];
}> = ({ user, upcomingMissions }) => {
	const upcoming = upcomingMissions ?? readUpcomingFromRequest();
	return (
		<>
			<header
				id="site-header"
				class="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/60 border-b border-white/[0.06] tx-btn"
				style={`height: ${HEADER_HEIGHT}px`}
			>
				<div class="max-w-[1600px] mx-auto px-6 md:px-10 h-full flex items-center justify-between">
					<a
						href="/"
						class="font-bold text-[13px] tracking-[1px] uppercase text-space-white hover:text-launch-cyan tx-btn"
					>
						launch<span class="text-space-500">.sksat.dev</span>
					</a>
					<button
						id="menu-toggle"
						type="button"
						aria-label="Open and close navigation menu"
						aria-expanded="false"
						aria-controls="mega-menu"
						class="menu-icon text-space-white tx-btn cursor-pointer hover:text-launch-cyan"
					>
						{/* Hamburger SVG — three 24×1px filled bars at y=4-5, 11-12, 18-19. */}
						<svg
							class="menu-icon-bars"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Open menu</title>
							<path d="M24 5L0 5L0 4L24 4V5Z" fill="currentColor" />
							<path d="M24 12L0 12L0 11L24 11V12Z" fill="currentColor" />
							<path d="M24 19L0 19L0 18L24 18V19Z" fill="currentColor" />
						</svg>
						{/* Close icon — same 1px hairline weight to morph cleanly. */}
						<svg
							class="menu-icon-close"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Close menu</title>
							<path
								d="M3.354 3.354 L20.646 20.646 L19.939 21.354 L2.646 4.061 Z"
								fill="currentColor"
							/>
							<path
								d="M20.646 3.354 L3.354 20.646 L2.646 19.939 L19.939 2.646 Z"
								fill="currentColor"
							/>
						</svg>
					</button>
				</div>
			</header>
			<div id="mega-menu" class="mega-menu fixed inset-0 z-40 bg-black" aria-hidden="true">
				{/* Vertical stack — full-screen mobile menu takeover. */}
				<nav
					class="px-6 md:px-10 flex flex-col"
					style={`padding-top: ${HEADER_HEIGHT + 24}px`}
					aria-label="Site navigation"
				>
					<ul class="flex flex-col">
						<li>
							<a
								href="/missions"
								class="block py-4 font-normal text-[18px] md:text-[22px] uppercase tracking-[1.17px] text-space-white/80 hover:text-space-white tx-btn"
							>
								Missions
							</a>
						</li>
						<li>
							<a
								href="/sites"
								class="block py-4 font-normal text-[18px] md:text-[22px] uppercase tracking-[1.17px] text-space-white/80 hover:text-space-white tx-btn"
							>
								Sites
							</a>
						</li>
						{user && (
							<li>
								<a
									href="/friends"
									class="block py-4 font-normal text-[18px] md:text-[22px] uppercase tracking-[1.17px] text-space-white/80 hover:text-space-white tx-btn"
								>
									Friends
								</a>
							</li>
						)}
					</ul>
					{/* "Upcoming Missions" widget — section heading + featured
				    mission cards + "All …" CTA. Auto-populated from
				    upcomingMissionsMiddleware via useRequestContext. */}
					<UpcomingMissionsWidget entries={upcoming} />
					{user ? (
						<div class="mt-10 pt-6 border-t border-white/[0.08] flex flex-col gap-3">
							<span class="font-mono text-[12px] text-space-400 tracking-wider">{user.login}</span>
							<form method="post" action="/auth/logout">
								<button
									type="submit"
									class="block py-2 font-normal text-[18px] md:text-[22px] uppercase tracking-[1.17px] text-space-500 hover:text-launch-red tx-btn cursor-pointer"
								>
									Logout
								</button>
							</form>
						</div>
					) : (
						<a
							href="/auth/login"
							class="mt-10 pt-6 border-t border-white/[0.08] block py-2 font-normal text-[18px] md:text-[22px] uppercase tracking-[1.17px] text-launch-cyan hover:text-space-white tx-btn"
						>
							Sign In
						</a>
					)}
				</nav>
			</div>
			<div style={`height: ${HEADER_HEIGHT}px`} />
			<script
				dangerouslySetInnerHTML={{
					__html: `
(function(){
  var h = document.getElementById('site-header');
  var btn = document.getElementById('menu-toggle');
  var menu = document.getElementById('mega-menu');
  if (!h || !btn || !menu) return;

  var open = false;
  function setOpen(next){
    if (next === open) return;
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('open', open);
    h.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('menu-locked', open);
    if (open) h.style.transform = 'translateY(0)';
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!open);
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && open) setOpen(false);
  });
  document.addEventListener('click', function(e){
    if (!open) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    setOpen(false);
  });
  menu.addEventListener('click', function(e){
    var t = e.target;
    while (t && t !== menu) {
      if (t.tagName === 'A') { setOpen(false); return; }
      t = t.parentNode;
    }
  });

  var lastY = window.scrollY;
  var hidden = false;
  window.addEventListener('scroll', function(){
    if (open) { lastY = window.scrollY; return; }
    var y = window.scrollY;
    var dy = y - lastY;
    if (y > 120 && dy > 4 && !hidden) {
      h.style.transform = 'translateY(-100%)';
      hidden = true;
    } else if ((dy < -4 || y < 60) && hidden) {
      h.style.transform = 'translateY(0)';
      hidden = false;
    }
    lastY = y;
  }, { passive: true });
})();
`,
				}}
			/>
		</>
	);
};
