import type { JSX } from "hono/jsx/jsx-runtime";
import { jsxRenderer } from "hono/jsx-renderer";

declare module "hono" {
	// biome-ignore lint/style/useShorthandFunctionType: interface is required
	// here because hono does declaration merging on `ContextRenderer` — a
	// `type` alias would shadow instead of augmenting the upstream type.
	interface ContextRenderer {
		(content: JSX.Element, props?: { title?: string }): Response | Promise<Response>;
	}
}

const GA_MEASUREMENT_ID = "G-D0YC7Q83RP";

export const renderer = jsxRenderer(({ children, title }) => {
	return (
		<html lang="en" class="bg-space-black text-space-white">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title ? `${title} | launch.sksat.dev` : "launch.sksat.dev"}</title>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
				{/* Roboto Mono — telemetry/label face.
				    D-DIN is self-hosted in /fonts/ via @font-face in style.css. */}
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap"
				/>
				<link
					href={import.meta.env.PROD ? "/assets/style.css" : "/src/style.css"}
					rel="stylesheet"
				/>
				{/* Google Analytics (GA4). Prod-only so dev/E2E traffic doesn't pollute the property. */}
				{import.meta.env.PROD && (
					<>
						<script
							async
							src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
						/>
						<script
							dangerouslySetInnerHTML={{
								__html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`,
							}}
						/>
					</>
				)}
			</head>
			<body class="min-h-screen font-sans antialiased">
				{children}
				{/* reveal-on-scroll observer (~280B) */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
(function(){
  var els = document.querySelectorAll('.reveal-on-scroll');
  if (!els.length) return;
  var reveal = function(e){ e.classList.add('in-view'); };
  if (!('IntersectionObserver' in window)) {
    els.forEach(reveal);
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function(e){ io.observe(e); });
  // Fallback: if any element is still hidden after 2.5s (e.g., headless screenshot,
  // anchor jump, or print), mark it visible so content is never trapped behind opacity:0.
  setTimeout(function(){
    document.querySelectorAll('.reveal-on-scroll:not(.in-view)').forEach(reveal);
  }, 2500);
})();
`,
					}}
				/>
			</body>
		</html>
	);
});
