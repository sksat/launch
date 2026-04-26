import type { FC } from "hono/jsx";
import { parseJstAware } from "../../lib/datetime";
import type { HeroImage } from "../../lib/hero-image";
import type { MissionRow } from "../../types";

function missionDisplayName(m: MissionRow): string {
	return m.seq > 1 ? `${m.callsign} #${m.seq}` : m.callsign;
}

const Reel: FC<{ digit: number; name: string }> = ({ digit, name }) => (
	<span class="cd-reel">
		<span class="cd-track" data-cd={name} style={`top:${-digit}em`}>
			{Array.from({ length: 10 }, (_, i) => (
				<span class="cd-digit" key={i}>
					{i}
				</span>
			))}
		</span>
	</span>
);

const HeroCountdown: FC<{ scheduledAt: string | null }> = ({ scheduledAt }) => {
	const baseClass =
		"font-mono uppercase tracking-[0.18em] text-base md:text-xl text-space-white tabular drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] leading-none";

	if (!scheduledAt) {
		return <div class={baseClass}>T -:--:--:--</div>;
	}

	const target = parseJstAware(scheduledAt).getTime();
	const diff = target - Date.now();
	const past = diff < 0;
	const abs = Math.abs(diff);
	const days = Math.floor(abs / 86_400_000);
	const hours = Math.floor((abs % 86_400_000) / 3_600_000);
	const minutes = Math.floor((abs % 3_600_000) / 60_000);
	const seconds = Math.floor((abs % 60_000) / 1000);
	const tens = (n: number) => Math.floor(n / 10) % 10;
	const ones = (n: number) => n % 10;

	return (
		<div data-tminus={target} class={baseClass}>
			<span>T </span>
			<span data-cd-sign>{past ? "+" : "-"}</span>
			<span data-cd-days style={days > 0 ? "" : "display:none"}>
				<Reel digit={tens(days)} name="d10" />
				<Reel digit={ones(days)} name="d1" />
				<span>:</span>
			</span>
			<Reel digit={tens(hours)} name="h10" />
			<Reel digit={ones(hours)} name="h1" />
			<span>:</span>
			<Reel digit={tens(minutes)} name="m10" />
			<Reel digit={ones(minutes)} name="m1" />
			<span>:</span>
			<Reel digit={tens(seconds)} name="s10" />
			<Reel digit={ones(seconds)} name="s1" />
		</div>
	);
};

/**
 * Cinematic hero — full viewport, image with bottom-left mission name
 * overlay. Used on home (featured mission) and mission detail.
 */
export const MissionHero: FC<{
	mission: MissionRow;
	image: HeroImage | null;
	eyebrow?: string;
	cta?: { label: string; href: string };
}> = ({ mission, image, eyebrow, cta }) => (
	<section
		class="relative w-full overflow-hidden bg-black -mt-[74px]"
		style="height: 100vh; min-height: 540px;"
	>
		{/* background image with darkening gradient */}
		{image ? (
			<>
				<img
					src={image.src}
					alt={image.alt}
					class="absolute inset-0 w-full h-full object-cover reveal-fade"
					style="object-position: 60% 25%;"
				/>
				<div
					class="absolute inset-0 pointer-events-none"
					style="background: linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.10) 25%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.92) 100%);"
				/>
			</>
		) : (
			<>
				<div class="starfield" aria-hidden="true" />
				<div
					class="absolute inset-0 pointer-events-none"
					style="background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(74,158,255,0.18), transparent 70%);"
				/>
			</>
		)}

		{/* mission name + T- countdown at bottom-left; countdown sits
		    just above the mission name. */}
		<div class="absolute bottom-0 left-0 right-0 px-6 md:px-12 pb-12 md:pb-16">
			<div class="max-w-[1600px] mx-auto">
				<div class="reveal-subheader mb-4">
					<HeroCountdown scheduledAt={mission.scheduled_at} />
				</div>
				{eyebrow && (
					<div class="reveal-subheader eyebrow text-launch-cyan mb-3" data-align-ink>
						{eyebrow}
					</div>
				)}
				<div class="reveal-header">
					<h1
						class="hero-title text-space-white text-[64px] sm:text-[96px] md:text-[128px] lg:text-[160px]"
						data-align-ink
					>
						{missionDisplayName(mission)}
					</h1>
				</div>
				{mission.title && (
					<div
						class="reveal-subheader mt-2 md:mt-4 text-base md:text-xl text-space-200 max-w-3xl"
						data-align-ink
					>
						{mission.title}
					</div>
				)}
				{cta && (
					<div class="reveal-button mt-5">
						<a
							href={cta.href}
							class="group inline-flex items-center gap-3 px-6 py-2.5 border border-white/30 hover:border-launch-cyan hover:bg-launch-cyan/10 tx-btn text-space-100 hover:text-launch-cyan font-bold text-[12px] uppercase tracking-[1.17px]"
						>
							{cta.label}
							<span class="text-space-400 group-hover:text-launch-cyan tx-btn">→</span>
						</a>
					</div>
				)}
			</div>
		</div>

		{/*
			Side-bearing compensation: big D-DIN glyphs like "L" have a non-zero
			left-side bearing (at 160px, "L" has LSB ≈ 9px) that visually shifts
			the ink rightward from the CSS box. That makes the hero stack look
			misaligned next to the bordered CTA button (whose border is a hard
			pixel at the container edge). We measure the first glyph's ink
			offset via TextMetrics and pull each row left by that amount with
			text-indent so every row's first ink column lands on the same X.
		*/}
		<script
			dangerouslySetInnerHTML={{
				__html: `
(function(){
  function align(){
    var els = document.querySelectorAll('[data-align-ink]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var text = (el.textContent || '').trim();
      if (!text) continue;
      var cs = getComputedStyle(el);
      var ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) continue;
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var m = ctx.measureText(text.charAt(0));
      var alb = m.actualBoundingBoxLeft;
      if (alb < 0) el.style.textIndent = alb + 'px';
    }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(align);
  } else {
    align();
  }
})();
`,
			}}
		/>

		{/* live-update T- script — drives the digit reels */}
		<script
			dangerouslySetInnerHTML={{
				__html: `
(function(){
  var root = document.querySelector('[data-tminus]');
  if (!root || !root.dataset.tminus) return;
  var t = Number(root.dataset.tminus);
  var tracks = {};
  var nodes = root.querySelectorAll('[data-cd]');
  for (var i = 0; i < nodes.length; i++) tracks[nodes[i].dataset.cd] = nodes[i];
  var sign = root.querySelector('[data-cd-sign]');
  var daysWrap = root.querySelector('[data-cd-days]');
  function set(name, n){ var el = tracks[name]; if (el) el.style.top = (-n) + 'em'; }
  function tick(){
    var diff = t - Date.now(), abs = Math.abs(diff);
    var d = Math.floor(abs/86400000);
    var h = Math.floor((abs%86400000)/3600000);
    var m = Math.floor((abs%3600000)/60000);
    var s = Math.floor((abs%60000)/1000);
    if (sign) sign.textContent = diff < 0 ? '+' : '-';
    if (daysWrap) daysWrap.style.display = d > 0 ? '' : 'none';
    set('d10', Math.floor(d/10) % 10); set('d1', d % 10);
    set('h10', Math.floor(h/10));      set('h1', h % 10);
    set('m10', Math.floor(m/10));      set('m1', m % 10);
    set('s10', Math.floor(s/10));      set('s1', s % 10);
  }
  tick(); setInterval(tick, 1000);
})();
`,
			}}
		/>
	</section>
);
