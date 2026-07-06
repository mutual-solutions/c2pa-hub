const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234a8b9c'/%3E%3Cpath d='M9 17l5 5 9-11' stroke='%23fff' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

function pageHead(title: string, description: string, path: string): string {
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#4a8b9c">
  <title>${title}</title>
  <link rel="canonical" href="https://c2pa.mutual.solutions${path}">
  <link rel="icon" type="image/svg+xml" href="${FAVICON}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="mutual">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="https://c2pa.mutual.solutions${path}">
  <meta property="og:image" content="https://c2pa.mutual.solutions/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..750&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;
}

function siteHeader(): string {
  return `<div class="accent-bar" aria-hidden="true"></div>
  <header class="site-header">
    <div class="app-shell">
      <a class="brand" href="/">
        <img src="https://mutual.solutions/img/logo.png" alt="mutual">
        <span class="brand-wordmark">
          <strong>mutual</strong>
          <span>C2PA search</span>
        </span>
      </a>
      <nav class="top-nav" aria-label="Site">
        <a href="/assets">Assets</a>
        <a href="/landscape">Landscape</a>
        <a href="/resources">Resources</a>
        <a href="/methodology">Methodology</a>
      </nav>
    </div>
  </header>`;
}

function siteFooter(): string {
  return `<footer class="site-footer">
    <div class="app-shell footer-inner">
      <div class="footer-brand">
        <strong>mutual C2PA search</strong>
        <p>A public search hub for C2PA-validated images, by <a href="https://mutual.solutions/" rel="noreferrer">mutual.solutions</a>.</p>
      </div>
      <nav class="footer-links" aria-label="Footer">
        <a href="/assets">Test assets</a>
        <a href="/landscape">Ecosystem landscape</a>
        <a href="/resources">Resources</a>
        <a href="/methodology">Methodology</a>
        <a href="/api/export.json">export.json</a>
        <a href="/api/export.csv">export.csv</a>
        <a href="/api/export.json?include_diagnostics=true">diagnostics export</a>
        <a href="https://github.com/mutual-solutions/c2pa-hub" rel="noreferrer" target="_blank">Open source ↗</a>
        <span class="footer-note">MCP endpoint: POST /mcp</span>
      </nav>
    </div>
  </footer>`;
}

const SHARED_STYLES = `
    :root {
      color-scheme: light;
      --m-blue: #4a8b9c;
      --m-blue-dark: #305e6c;
      --m-blue-deep: #2a4d59;
      --m-blue-light: #e0f2f6;
      --m-blue-tint: #f2f9fb;
      --m-slate-900: #0f172a;
      --m-slate-800: #1e293b;
      --m-slate-700: #334155;
      --m-slate-600: #475569;
      --m-slate-500: #64748b;
      --m-slate-400: #94a3b8;
      --m-slate-300: #cbd5e1;
      --m-slate-200: #e2e8f0;
      --m-slate-100: #f1f5f9;
      --m-green-ink: #065f46;
      --m-green-bg: #ecfdf5;
      --m-green-line: #a7f3d0;
      --m-red-ink: #b91c1c;
      --surface: #ffffff;
      --line: #e2e8f0;
      --ink: #0f172a;
      --font-display: "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font-display);
      font-size: 15px;
      color: var(--ink);
      background: var(--surface);
      -webkit-font-smoothing: antialiased;
    }
    a, button, input { font: inherit; }
    a { color: inherit; text-decoration: none; }
    :focus-visible {
      outline: 2px solid var(--m-blue);
      outline-offset: 2px;
    }
    .app-shell {
      width: min(1180px, calc(100vw - 48px));
      margin: 0 auto;
    }
    .accent-bar {
      height: 3px;
      background: var(--m-blue);
    }
    .site-header {
      background: rgba(255, 255, 255, 0.92);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(12px);
    }
    .site-header .app-shell {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      min-height: 64px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }
    .brand img {
      width: 32px;
      height: 32px;
      display: block;
      border-radius: 6px;
    }
    .brand-wordmark {
      display: grid;
      gap: 1px;
      min-width: 0;
    }
    .brand-wordmark strong {
      font-size: 16px;
      font-weight: 650;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--m-slate-900);
    }
    .brand-wordmark span {
      color: var(--m-slate-600);
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .top-nav {
      display: flex;
      gap: 22px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .top-nav a {
      color: var(--m-slate-600);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      padding: 4px 0;
      border-bottom: 1px solid transparent;
      transition: color 130ms ease, border-color 130ms ease;
    }
    .top-nav a:hover {
      color: var(--m-blue-dark);
      border-bottom-color: var(--m-blue);
    }
    .hero-band {
      background:
        linear-gradient(rgba(74, 139, 156, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(74, 139, 156, 0.045) 1px, transparent 1px),
        var(--m-blue-tint);
      background-size: 28px 28px, 28px 28px, auto;
      border-bottom: 1px solid var(--line);
    }
    .hero-inner {
      padding: 64px 0 52px;
    }
    .hero-inner-compact {
      padding: 48px 0 42px;
    }
    .section-label-mono {
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--m-blue-dark);
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }
    .hero-copy h1 {
      margin: 16px 0 14px;
      font-size: clamp(34px, 5vw, 52px);
      font-weight: 650;
      line-height: 1.06;
      letter-spacing: -0.03em;
      color: var(--m-slate-900);
    }
    .hero-copy h1 em {
      font-style: normal;
      color: var(--m-blue-dark);
      text-decoration: underline;
      text-decoration-color: var(--m-blue);
      text-decoration-thickness: 3px;
      text-underline-offset: 7px;
    }
    .hero-copy p {
      margin: 0 0 30px;
      max-width: 640px;
      color: var(--m-slate-600);
      font-size: 17px;
      line-height: 1.6;
    }
    .hero-inner-compact .hero-copy h1 {
      font-size: clamp(30px, 4vw, 42px);
    }
    .hero-inner-compact .hero-copy p {
      margin-bottom: 0;
    }
    .search-console {
      min-width: 0;
      max-width: 860px;
    }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px;
      align-items: center;
    }
    input, button {
      min-height: 46px;
      border-radius: 6px;
    }
    input {
      border: 1px solid var(--m-slate-300);
      background: var(--surface);
      color: var(--m-slate-900);
      padding: 0 14px;
      min-width: 0;
      outline: none;
      transition: border-color 130ms ease, box-shadow 130ms ease;
    }
    input::placeholder {
      color: var(--m-slate-400);
    }
    input:focus {
      border-color: var(--m-blue);
      box-shadow: 0 0 0 3px rgba(74, 139, 156, 0.18);
    }
    button {
      border: 1px solid var(--m-blue-dark);
      background: var(--m-blue-dark);
      color: #ffffff;
      padding: 0 20px;
      font-weight: 650;
      letter-spacing: -0.01em;
      cursor: pointer;
      transition: background 130ms ease, border-color 130ms ease;
    }
    button:hover {
      background: var(--m-blue-deep);
      border-color: var(--m-blue-deep);
    }
    .tabs {
      display: inline-grid;
      grid-template-columns: repeat(2, minmax(88px, 1fr));
      border: 1px solid var(--m-slate-300);
      border-radius: 6px;
      overflow: hidden;
      background: var(--m-slate-100);
      padding: 3px;
      gap: 3px;
    }
    .tabs button {
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--m-slate-600);
      min-height: 38px;
      padding: 0 14px;
      font-weight: 600;
    }
    .tabs button:hover {
      color: var(--m-blue-dark);
      background: rgba(74, 139, 156, 0.08);
    }
    .tabs button[aria-selected="true"] {
      background: var(--surface);
      color: var(--m-slate-900);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    }
    .statusline {
      min-height: 22px;
      margin-top: 14px;
      color: var(--m-slate-600);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
    }
    .statusline::before {
      content: "";
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--m-blue);
      margin-right: 8px;
      vertical-align: 1px;
    }
    .stat-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-top: 18px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-600);
    }
    .stat-strip[hidden] {
      display: none;
    }
    .stat-strip strong {
      color: var(--m-slate-900);
      font-weight: 700;
    }
    .stat-sep {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--m-slate-300);
    }
    .load-more-wrap {
      display: flex;
      justify-content: center;
      margin-top: 26px;
    }
    .load-more-wrap button {
      background: var(--surface);
      border: 1px solid var(--m-slate-300);
      color: var(--m-blue-dark);
      min-width: 200px;
    }
    .load-more-wrap button:hover {
      border-color: var(--m-blue);
      background: var(--m-blue-tint);
      color: var(--m-blue-deep);
    }
    .site-footer {
      border-top: 1px solid var(--line);
      background: var(--m-blue-tint);
    }
    .footer-inner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding: 30px 0 42px;
      flex-wrap: wrap;
    }
    .footer-brand {
      max-width: 420px;
    }
    .footer-brand strong {
      display: block;
      color: var(--m-slate-900);
      font-size: 14px;
      font-weight: 650;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }
    .footer-brand p {
      margin: 0;
      color: var(--m-slate-600);
      font-size: 13px;
      line-height: 1.6;
    }
    .footer-brand a {
      color: var(--m-blue-dark);
      border-bottom: 1px solid var(--m-slate-300);
    }
    .footer-brand a:hover {
      border-bottom-color: var(--m-blue);
    }
    .footer-links {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .footer-links a {
      color: var(--m-slate-600);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      border-bottom: 1px solid transparent;
      transition: color 130ms ease, border-color 130ms ease;
    }
    .footer-links a:hover {
      color: var(--m-blue-dark);
      border-bottom-color: var(--m-blue);
    }
    .footer-note {
      color: var(--m-slate-600);
      font-family: var(--font-mono);
      font-size: 11px;
    }
    .results-area {
      padding: 40px 0 48px;
    }
    .results-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 16px;
      padding-bottom: 16px;
      margin-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }
    .results-title {
      margin: 0;
      color: var(--m-slate-900);
      font-size: 24px;
      font-weight: 650;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .results-subtitle {
      margin: 6px 0 0;
      color: var(--m-slate-500);
      font-size: 14px;
      line-height: 1.5;
    }
    .export-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 18px;
    }
    .export-links a {
      color: var(--m-slate-600);
      font-size: 12px;
      font-family: var(--font-mono);
      font-weight: 500;
      padding: 4px 0;
      border-bottom: 1px solid var(--m-slate-300);
      transition: color 130ms ease, border-color 130ms ease;
    }
    .export-links a:hover {
      border-color: var(--m-blue);
      color: var(--m-blue-dark);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(286px, 1fr));
      gap: 20px;
      align-items: stretch;
    }
    @keyframes card-rise {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes shimmer {
      to { background-position: -200% 0; }
    }
    .skel {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      overflow: hidden;
    }
    .skel-thumb {
      aspect-ratio: 4 / 3;
    }
    .skel-body {
      padding: 15px;
      display: grid;
      gap: 11px;
    }
    .skel-line {
      height: 12px;
      border-radius: 4px;
    }
    .skel-thumb, .skel-line {
      background: linear-gradient(90deg, var(--m-slate-100) 25%, #e7edf3 50%, var(--m-slate-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.3s linear infinite;
    }
    .skel-w40 { width: 40%; }
    .skel-w80 { width: 80%; }
    .skel-w60 { width: 60%; }
    .state-block {
      grid-column: 1 / -1;
      border: 1px dashed var(--m-slate-300);
      border-radius: 6px;
      padding: 44px 24px;
      text-align: center;
    }
    .state-kicker {
      margin: 0 0 10px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--m-blue-dark);
    }
    .state-error .state-kicker {
      color: var(--m-red-ink);
    }
    .state-copy {
      margin: 0 auto;
      max-width: 480px;
      color: var(--m-slate-600);
      font-size: 14px;
      line-height: 1.6;
    }
    .item {
      display: grid;
      grid-template-rows: auto 1fr;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      min-width: 0;
      overflow: hidden;
      animation: card-rise 420ms cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
    }
    .item:hover {
      border-color: rgba(74, 139, 156, 0.5);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.1);
      transform: translateY(-2px);
    }
    @media (prefers-reduced-motion: reduce) {
      .item { animation: none; transition: none; }
      .item:hover { transform: none; }
      .skel-thumb, .skel-line { animation: none; }
    }
    .thumb {
      position: relative;
      aspect-ratio: 4 / 3;
      background: var(--m-slate-900);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--m-slate-400);
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 13px;
      overflow: hidden;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-label {
      position: absolute;
      top: 10px;
      left: 10px;
      border-radius: 3px;
      background: rgba(15, 23, 42, 0.66);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.4);
      padding: 4px 7px;
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      backdrop-filter: blur(4px);
    }
    .thumb-fallback {
      color: var(--m-blue);
      letter-spacing: 0.14em;
    }
    .thumb.is-empty::after {
      content: "C2PA";
      color: var(--m-blue);
      letter-spacing: 0.14em;
    }
    .meta {
      padding: 15px;
      display: grid;
      gap: 11px;
      min-width: 0;
      align-content: start;
    }
    .card-kicker {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 23px;
      padding: 2px 9px;
      border-radius: 100px;
      border: 1px solid var(--line);
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--m-slate-700);
      background: var(--m-slate-100);
      flex: 0 0 auto;
    }
    .pill::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .pill-real {
      color: var(--m-green-ink);
      background: var(--m-green-bg);
      border-color: var(--m-green-line);
    }
    .pill-edited {
      color: var(--m-blue-dark);
      background: var(--m-blue-light);
      border-color: rgba(74, 139, 156, 0.34);
    }
    .classification {
      color: var(--m-slate-500);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      text-align: right;
    }
    .url {
      color: var(--m-slate-900);
      font-weight: 650;
      font-size: 14.5px;
      letter-spacing: -0.01em;
      line-height: 1.35;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      transition: color 130ms ease;
    }
    .url:hover {
      color: var(--m-blue-dark);
    }
    .host {
      color: var(--m-slate-500);
      font-family: var(--font-mono);
      font-size: 11.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .facts {
      display: grid;
      gap: 8px;
      border-top: 1px solid var(--m-slate-200);
      padding-top: 11px;
    }
    .row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .label {
      flex: 0 0 auto;
      color: var(--m-slate-500);
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .leader {
      flex: 1 1 16px;
      min-width: 16px;
      border-bottom: 1px dotted var(--m-slate-300);
      transform: translateY(-3px);
    }
    .value {
      flex: 0 1 auto;
      min-width: 0;
      color: var(--m-slate-800);
      overflow-wrap: anywhere;
      text-align: right;
      font-size: 13px;
      line-height: 1.4;
    }
    .card-actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid var(--m-slate-200);
      padding-top: 11px;
    }
    .card-actions > :only-child {
      margin-left: auto;
    }
    .text-button {
      background: none;
      border: 0;
      padding: 0;
      min-height: auto;
      color: var(--m-blue-dark);
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      transition: color 130ms ease;
    }
    .text-button:hover {
      background: none;
      border: 0;
    }
    a.text-button::after {
      content: " \\2197";
      font-size: 12px;
    }
    .text-button:hover {
      color: var(--m-slate-900);
    }
    .value-filter {
      background: none;
      border: 0;
      padding: 0;
      min-height: auto;
      font-size: 13px;
      font-weight: 400;
      letter-spacing: 0;
      color: var(--m-slate-800);
      text-align: right;
      cursor: pointer;
      overflow-wrap: anywhere;
    }
    .value-filter:hover {
      background: none;
      border: 0;
      color: var(--m-blue-dark);
      text-decoration: underline;
    }
    .detail-dialog {
      border: 0;
      border-radius: 8px;
      padding: 0;
      width: min(560px, calc(100vw - 32px));
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
      overflow: hidden;
    }
    .detail-dialog::backdrop {
      background: rgba(15, 23, 42, 0.55);
    }
    .detail-thumb {
      aspect-ratio: 16 / 9;
      background: var(--m-slate-900);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--m-blue);
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.14em;
      overflow: hidden;
    }
    .detail-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .detail-thumb.is-empty::after {
      content: "C2PA";
    }
    .detail-body {
      padding: 18px;
      display: grid;
      gap: 14px;
    }
    .detail-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .detail-title {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
      letter-spacing: -0.01em;
      line-height: 1.35;
      overflow-wrap: anywhere;
      color: var(--m-slate-900);
    }
    .detail-close {
      background: none;
      border: 0;
      padding: 4px;
      min-height: auto;
      color: var(--m-slate-500);
      font-size: 15px;
      line-height: 1;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .detail-close:hover {
      background: none;
      border: 0;
      color: var(--m-slate-900);
    }
    .submitter-block {
      margin-top: 40px;
      border-top: 1px solid var(--line);
      padding-top: 24px;
    }
    .submitter-label {
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--m-slate-500);
      margin: 0 0 12px;
    }
    .submitter {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      max-width: 720px;
    }
    .submitter button {
      background: var(--m-slate-900);
      border-color: var(--m-slate-900);
    }
    .submitter button:hover {
      background: var(--m-blue-dark);
      border-color: var(--m-blue-dark);
    }
    .method {
      color: var(--m-slate-500);
      border-top: 1px solid var(--line);
      padding: 22px 0 40px;
      font-size: 13px;
      line-height: 1.6;
    }
    .method-inner {
      max-width: 860px;
    }
    .method strong {
      color: var(--m-slate-800);
      font-weight: 650;
    }
    .prose-area {
      padding: 36px 0 56px;
    }
    .prose-area h2 {
      margin: 40px 0 18px;
      padding-top: 28px;
      border-top: 1px solid var(--line);
      color: var(--m-slate-900);
      font-size: 20px;
      font-weight: 650;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    .prose-area h2:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
    .def-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }
    .def-card {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 16px;
      display: grid;
      gap: 10px;
      justify-items: start;
      align-content: start;
      background: var(--surface);
    }
    .def-card p {
      margin: 0;
      color: var(--m-slate-600);
      font-size: 13.5px;
      line-height: 1.55;
    }
    .chips {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chips li {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-600);
      border: 1px solid var(--line);
      border-radius: 100px;
      padding: 6px 12px;
      background: var(--surface);
    }
    .lim-list {
      list-style: none;
      counter-reset: lim;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 14px;
      max-width: 780px;
    }
    .lim-list li {
      counter-increment: lim;
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 12px;
      color: var(--m-slate-600);
      font-size: 14px;
      line-height: 1.6;
    }
    .lim-list li::before {
      content: counter(lim, decimal-leading-zero);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--m-blue-dark);
      padding-top: 3px;
    }
    .api-note {
      margin: 36px 0 0;
      padding-top: 24px;
      border-top: 1px solid var(--line);
      color: var(--m-slate-500);
      font-size: 13px;
      line-height: 1.6;
    }
    .api-note a {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-blue-dark);
      border-bottom: 1px solid var(--m-slate-300);
    }
    .api-note a:hover {
      border-bottom-color: var(--m-blue);
    }
    .api-note .mono {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .back-link {
      display: inline-block;
      margin-top: 18px;
      color: var(--m-blue-dark);
      font-size: 13px;
      font-weight: 650;
    }
    .back-link::before {
      content: "\\2190 ";
    }
    .back-link:hover {
      color: var(--m-slate-900);
    }
    .pipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      counter-reset: pipe;
    }
    .pipe-step {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 16px;
      display: grid;
      gap: 8px;
      align-content: start;
      background: var(--surface);
      counter-increment: pipe;
    }
    .pipe-step::before {
      content: counter(pipe, decimal-leading-zero);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      color: var(--m-blue-dark);
      letter-spacing: 0.06em;
    }
    .pipe-step strong {
      color: var(--m-slate-800);
      font-size: 15px;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .pipe-step p {
      margin: 0;
      color: var(--m-slate-600);
      font-size: 13.5px;
      line-height: 1.55;
    }
    @media (max-width: 760px) {
      .app-shell {
        width: min(100vw - 32px, 1180px);
      }
      .site-header .app-shell {
        min-height: auto;
        padding: 12px 0;
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
      }
      .top-nav {
        justify-content: flex-start;
        gap: 16px;
      }
      .hero-inner {
        padding: 40px 0 36px;
      }
      .hero-copy p {
        font-size: 15.5px;
        margin-bottom: 24px;
      }
      .hero-inner-compact .hero-copy p {
        margin-bottom: 0;
      }
      .toolbar, .submitter {
        grid-template-columns: 1fr;
      }
      .tabs {
        width: 100%;
      }
      .toolbar button, .submitter button, .load-more-wrap button {
        width: 100%;
      }
      .results-head {
        align-items: flex-start;
        flex-direction: column;
      }
      .export-links {
        justify-content: flex-start;
      }
      .grid {
        grid-template-columns: 1fr;
      }
      .footer-inner {
        flex-direction: column;
      }
      .footer-links {
        align-items: flex-start;
      }
    }
    @media (max-width: 420px) {
      .brand-wordmark span {
        display: none;
      }
    }`;

export function renderHome(): string {
  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead("mutual C2PA Search", "A search hub for C2PA-validated real and edited images.", "/")}
  <style>${SHARED_STYLES}
  </style>
</head>
<body>
  ${siteHeader()}

  <main>
    <section class="hero-band">
      <div class="app-shell hero-inner">
        <div class="hero-copy">
          <div class="section-label-mono">C2PA-validated image search</div>
          <h1>A hub for real images with <em>signed provenance</em>.</h1>
          <p>Signed at capture. Before software can touch it. Search verified camera captures separately from edited images with preserved C2PA history.</p>
        </div>

        <div class="search-console" aria-label="Search corpus">
          <div class="toolbar">
            <input id="query" type="search" placeholder="Search signer, generator, or domain" aria-label="Search signer, generator, or domain" autocomplete="off">
            <div class="tabs" role="tablist" aria-label="category">
              <button id="tab-real" type="button" role="tab" aria-selected="true" aria-controls="results" tabindex="0">Real</button>
              <button id="tab-edited" type="button" role="tab" aria-selected="false" aria-controls="results" tabindex="-1">Edited</button>
            </div>
            <button id="search" type="button">Search</button>
          </div>
          <div id="status" class="statusline">Loading C2PA corpus...</div>
          <div id="stats" class="stat-strip" hidden>
            <span><strong id="stat-real">0</strong> real</span>
            <span class="stat-sep" aria-hidden="true"></span>
            <span><strong id="stat-edited">0</strong> edited</span>
            <span class="stat-sep" aria-hidden="true"></span>
            <span>last validated <strong id="stat-last">pending</strong></span>
          </div>
        </div>
      </div>
    </section>

    <section class="app-shell results-area">
      <div class="results-head">
        <div>
          <h2 class="results-title">Verified corpus</h2>
          <p class="results-subtitle">Public results exclude AI-generated-only assets and unknown provenance.</p>
        </div>
        <div class="export-links" aria-label="Data exports">
          <a href="/api/export.json">export.json</a>
          <a href="/api/export.csv">export.csv</a>
          <a href="/api/export.json?include_diagnostics=true">diagnostics</a>
        </div>
      </div>

      <section id="results" class="grid" role="tabpanel" aria-live="polite"></section>

      <div class="load-more-wrap">
        <button id="load-more" type="button" hidden>Load more</button>
      </div>

      <dialog id="detail" class="detail-dialog" aria-labelledby="detail-title">
        <div id="detail-thumb" class="detail-thumb"></div>
        <div class="detail-body">
          <div class="detail-top">
            <h3 id="detail-title" class="detail-title"></h3>
            <button type="button" id="detail-close" class="detail-close" aria-label="Close details">&#10005;</button>
          </div>
          <div id="detail-facts" class="facts"></div>
          <div class="card-actions"><a id="detail-open" class="text-button" rel="noreferrer" target="_blank">Open original</a></div>
        </div>
      </dialog>

      <div class="submitter-block">
        <p class="submitter-label">Submit a public source for validation</p>
        <form id="crawl" class="submitter">
          <input id="seed" type="url" placeholder="https://example.com/page-or-photo.jpg" aria-label="Public source URL" autocomplete="off">
          <button type="submit">Queue source</button>
        </form>
      </div>
    </section>

    <section class="app-shell method">
      <div class="method-inner">
        <strong>Method:</strong> direct capture appears in Real when the C2PA manifest validates to trusted camera capture. Edited images are kept in their own category. Pure AI-generated disclosed assets and unsigned media stay out of public search; soft-binding recovery remains diagnostic until separately validated. <a href="/methodology">Read the full methodology</a>.
      </div>
    </section>
  </main>

  ${siteFooter()}

  <script>
    const PAGE_LIMIT = 24;
    const state = { category: "real", cursor: null, requestGen: 0 };
    const results = document.querySelector("#results");
    const status = document.querySelector("#status");
    const query = document.querySelector("#query");
    const seed = document.querySelector("#seed");
    const tabReal = document.querySelector("#tab-real");
    const tabEdited = document.querySelector("#tab-edited");
    const loadMoreButton = document.querySelector("#load-more");
    const detail = document.querySelector("#detail");
    const assetById = new Map();
    let detailTrigger = null;
    let initialAssetId = null;

    tabReal.addEventListener("click", () => selectCategory("real"));
    tabEdited.addEventListener("click", () => selectCategory("edited"));
    document.querySelector(".tabs").addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = state.category === "real" ? "edited" : "real";
      selectCategory(next);
      (next === "real" ? tabReal : tabEdited).focus();
    });
    document.querySelector("#search").addEventListener("click", loadAssets);
    loadMoreButton.addEventListener("click", loadMore);
    query.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadAssets();
    });
    document.querySelector("#crawl").addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = seed.value.trim();
      if (!value) return;
      status.textContent = "Queueing source...";
      try {
        const response = await fetch("/api/crawl-runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sources: [{ type: "manual_seed", value }] }),
        });
        const data = await response.json();
        status.textContent = response.ok ? "Crawl run #" + data.crawl_run_id + " queued." : data.error || "Queue failed.";
        seed.value = "";
      } catch {
        status.textContent = "Queue failed. Check the connection and try again.";
      }
    });

    function applyCategory(category) {
      state.category = category;
      tabReal.setAttribute("aria-selected", String(category === "real"));
      tabEdited.setAttribute("aria-selected", String(category === "edited"));
      tabReal.tabIndex = category === "real" ? 0 : -1;
      tabEdited.tabIndex = category === "edited" ? 0 : -1;
    }

    function selectCategory(category) {
      applyCategory(category);
      loadAssets();
    }

    function syncUrl() {
      const params = new URLSearchParams();
      const q = query.value.trim();
      if (q) params.set("q", q);
      if (state.category !== "real") params.set("category", state.category);
      const qs = params.toString();
      history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    }

    function restoreFromUrl() {
      const params = new URLSearchParams(location.search);
      const q = params.get("q");
      if (q) query.value = q;
      if (params.get("category") === "edited") applyCategory("edited");
      const assetParam = params.get("asset");
      if (assetParam && /^[1-9]\\d*$/.test(assetParam)) initialAssetId = parseInt(assetParam, 10);
    }

    function renderSkeletons() {
      results.innerHTML = Array.from({ length: 6 }, () =>
        '<div class="skel" aria-hidden="true"><div class="skel-thumb"></div><div class="skel-body"><span class="skel-line skel-w40"></span><span class="skel-line skel-w80"></span><span class="skel-line skel-w60"></span></div></div>'
      ).join("");
    }

    function renderEmptyState() {
      results.innerHTML = '<div class="state-block"><p class="state-kicker">No results</p><p class="state-copy">No public ' + state.category + ' results match this query yet. Queue a public source below and it will be crawled, validated, and classified into the corpus.</p></div>';
    }

    function renderErrorState() {
      results.innerHTML = '<div class="state-block state-error"><p class="state-kicker">Error</p><p class="state-copy">Could not reach the corpus API. Check the connection and try again in a moment.</p></div>';
    }

    function assetParams() {
      const params = new URLSearchParams({ category: state.category, limit: String(PAGE_LIMIT) });
      const q = query.value.trim();
      if (q) params.set("q", q);
      return params;
    }

    function updateLoadMore(nextCursor) {
      state.cursor = nextCursor || null;
      loadMoreButton.hidden = !state.cursor;
    }

    function updateStatus() {
      const count = results.querySelectorAll(".item").length;
      status.textContent = count
        ? count + " " + state.category + " result" + (count === 1 ? "" : "s") + (state.cursor ? " shown" : "")
        : "No public " + state.category + " results yet.";
    }

    async function loadAssets() {
      const gen = ++state.requestGen;
      assetById.clear();
      syncUrl();
      status.textContent = "Searching " + state.category + " images...";
      updateLoadMore(null);
      renderSkeletons();
      try {
        const response = await fetch("/api/assets?" + assetParams().toString());
        const data = await response.json();
        if (gen !== state.requestGen) return;
        if (!response.ok) throw new Error(data.error || "search failed");
        const assets = data.assets || [];
        if (!assets.length) {
          renderEmptyState();
          updateStatus();
          return;
        }
        results.innerHTML = buildCards(assets);
        updateLoadMore(data.next_cursor);
        updateStatus();
      } catch {
        if (gen !== state.requestGen) return;
        status.textContent = "Search failed.";
        renderErrorState();
      }
    }

    async function loadMore() {
      if (!state.cursor) return;
      const gen = state.requestGen;
      const params = assetParams();
      params.set("cursor", state.cursor);
      loadMoreButton.disabled = true;
      try {
        const response = await fetch("/api/assets?" + params.toString());
        const data = await response.json();
        if (gen !== state.requestGen) return;
        if (!response.ok) throw new Error(data.error || "search failed");
        results.insertAdjacentHTML("beforeend", buildCards(data.assets || []));
        updateLoadMore(data.next_cursor);
        updateStatus();
      } catch {
        if (gen !== state.requestGen) return;
        status.textContent = "Could not load more results.";
      } finally {
        loadMoreButton.disabled = false;
      }
    }

    async function loadStats() {
      try {
        const response = await fetch("/api/stats");
        if (!response.ok) return;
        const data = await response.json();
        document.querySelector("#stat-real").textContent = String(data.real_count ?? 0);
        document.querySelector("#stat-edited").textContent = String(data.edited_count ?? 0);
        document.querySelector("#stat-last").textContent = data.last_validated_at ? formatDate(data.last_validated_at) : "pending";
        document.querySelector("#stats").hidden = false;
      } catch {
        /* stat strip stays hidden */
      }
    }

    function buildCards(assets) {
      return assets.map((asset, index) => {
        assetById.set(String(asset.id), asset);
        const image = renderAssetImage(asset, index);
        const category = normalizeCategory(asset.public_category);
        const delay = Math.min(index, 8) * 45;
        return '<article class="item" style="animation-delay:' + delay + 'ms">' +
          '<div class="thumb">' + image + '<span class="thumb-label">C2PA</span></div>' +
          '<div class="meta">' +
            '<div class="card-kicker"><span class="pill pill-' + category + '">' + escapeHtml(displayCategory(category)) + '</span><span class="classification">' + escapeHtml(humanize(asset.classification || "validated")) + '</span></div>' +
            '<a class="url" href="' + escapeHtml(asset.url) + '" rel="noreferrer" target="_blank">' + escapeHtml(displayUrl(asset.url)) + '</a>' +
            '<div class="host">' + escapeHtml(asset.domain || shortHost(asset.url)) + '</div>' +
            '<div class="facts">' +
              filterableRow("Signer", asset.signer) +
              filterableRow("Generator", asset.claim_generator) +
              row("Validated", formatDate(asset.latest_validated_at || "pending")) +
            '</div>' +
            '<div class="card-actions"><button type="button" class="text-button detail-button" data-id="' + escapeHtml(String(asset.id)) + '">Details</button><a class="text-button" href="' + escapeHtml(asset.url) + '" rel="noreferrer" target="_blank">Open original</a></div>' +
          '</div>' +
        '</article>';
      }).join("");
    }

    function filterableRow(label, value) {
      if (!value || value === "unknown") return row(label, "unknown");
      return '<div class="row"><span class="label">' + escapeHtml(label) + '</span><span class="leader" aria-hidden="true"></span><button type="button" class="value value-filter" data-filter="' + escapeHtml(value) + '" title="Filter by ' + escapeHtml(value) + '">' + escapeHtml(value) + '</button></div>';
    }

    function applyFilter(value) {
      query.value = value;
      loadAssets();
      const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.querySelector(".results-head").scrollIntoView({ behavior: smooth });
    }

    function openDetail(asset, trigger) {
      if (!asset) return;
      detailTrigger = trigger;
      const category = normalizeCategory(asset.public_category);
      document.querySelector("#detail-thumb").innerHTML = renderAssetImage(asset, 0);
      document.querySelector("#detail-thumb").classList.remove("is-empty");
      document.querySelector("#detail-title").textContent = displayUrl(asset.url);
      const facts = [
        row("Category", displayCategory(category)),
        row("Classification", humanize(asset.classification || "validated")),
        row("Signer", asset.signer || "unknown"),
        row("Generator", asset.claim_generator || "unknown"),
        row("Domain", asset.domain || shortHost(asset.url)),
        row("Source", humanize(asset.source_type || "unknown")),
        row("Content type", asset.content_type || "unknown"),
        row("Validated", formatDate(asset.latest_validated_at || "pending")),
      ];
      if (asset.platform_claim_app) facts.push(row("Platform app", asset.platform_claim_app));
      if (asset.platform_claim_issued_by) facts.push(row("Claim issued by", asset.platform_claim_issued_by));
      if (asset.platform_claim_issued_at) facts.push(row("Claim issued at", formatDate(asset.platform_claim_issued_at)));
      if (asset.platform_claim_ai_disclosure) facts.push(row("AI disclosure", humanize(asset.platform_claim_ai_disclosure)));
      document.querySelector("#detail-facts").innerHTML = facts.join("");
      document.querySelector("#detail-open").href = asset.url;
      detail.showModal();
      setAssetParam(asset.id);
    }

    results.addEventListener("click", (event) => {
      const filterButton = event.target.closest(".value-filter");
      if (filterButton) {
        applyFilter(filterButton.dataset.filter);
        return;
      }
      const detailButton = event.target.closest(".detail-button");
      if (detailButton) openDetail(assetById.get(detailButton.dataset.id), detailButton);
    });
    document.querySelector("#detail-close").addEventListener("click", () => detail.close());
    detail.addEventListener("click", (event) => {
      if (event.target === detail) detail.close();
    });
    detail.addEventListener("close", () => {
      if (detailTrigger) detailTrigger.focus();
      detailTrigger = null;
      setAssetParam(null);
    });

    function renderAssetImage(asset, index) {
      if (!isRenderableImageAsset(asset)) return '<span class="thumb-fallback">C2PA</span>';
      const loading = index < 4 ? "eager" : "lazy";
      const priority = index < 4 ? ' fetchpriority="high"' : "";
      return '<img src="/api/image/' + encodeURIComponent(String(asset.id)) + '" loading="' + loading + '"' + priority + ' alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add(\\'is-empty\\');this.remove()">';
    }

    function isRenderableImageAsset(asset) {
      const contentType = String(asset.content_type || "").toLowerCase();
      const url = String(asset.url || "");
      const lowerUrl = url.toLowerCase();
      return contentType.startsWith("image/") ||
        isFotoForensicsOriginal(lowerUrl) ||
        /\\.(avif|gif|jpe?g|png|webp)(\\?|$)/.test(lowerUrl);
    }

    function isFotoForensicsOriginal(value) {
      try {
        const url = new URL(value);
        return (url.hostname === "fotoforensics.com" || url.hostname === "www.fotoforensics.com") &&
          url.pathname === "/analysis.php" &&
          url.searchParams.get("fmt") === "orig";
      } catch {
        return false;
      }
    }

    function row(label, value) {
      return '<div class="row"><span class="label">' + escapeHtml(label) + '</span><span class="leader" aria-hidden="true"></span><span class="value">' + escapeHtml(value) + '</span></div>';
    }

    function normalizeCategory(value) {
      return String(value || "").toLowerCase() === "edited" ? "edited" : "real";
    }

    function displayCategory(category) {
      return category === "edited" ? "Edited" : "Real";
    }

    function humanize(value) {
      return String(value || "").replace(/_/g, " ");
    }

    function shortHost(value) {
      try {
        return new URL(String(value)).hostname.replace(/^www\\./, "");
      } catch {
        return "";
      }
    }

    function displayUrl(value) {
      try {
        const url = new URL(String(value));
        const parts = url.pathname.split("/").filter(Boolean);
        const tail = parts.length ? decodeURIComponent(parts[parts.length - 1]) : "";
        return tail ? url.hostname.replace(/^www\\./, "") + " / " + tail : url.hostname.replace(/^www\\./, "");
      } catch {
        return String(value || "");
      }
    }

    function formatDate(value) {
      const raw = String(value || "");
      const date = new Date(raw);
      if (!raw || Number.isNaN(date.getTime())) return raw || "pending";
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }

    function setAssetParam(id) {
      const params = new URLSearchParams(location.search);
      if (id != null) {
        params.set("asset", String(id));
      } else {
        params.delete("asset");
      }
      const qs = params.toString();
      history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    }

    async function openInitialAsset(id) {
      const asset = assetById.get(String(id));
      if (asset) {
        openDetail(asset, null);
        return;
      }
      try {
        const response = await fetch("/api/assets/" + id);
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.asset) openDetail(data.asset, null);
      } catch {
        /* silently do nothing */
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char]));
    }

    restoreFromUrl();
    loadAssets().then(() => {
      if (initialAssetId) openInitialAsset(initialAssetId);
    });
    loadStats();
  </script>
</body>
</html>`;
}

export function renderMethodology(version = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead("Methodology · mutual C2PA Search", "How the mutual C2PA corpus is discovered, validated, and classified.", "/methodology")}
  <style>${SHARED_STYLES}
  </style>
</head>
<body>
  ${siteHeader()}

  <main>
    <section class="hero-band">
      <div class="app-shell hero-inner hero-inner-compact">
        <div class="hero-copy">
          <div class="section-label-mono">Methodology</div>
          <h1>How the corpus is built and classified.</h1>
          <p>Every asset in public search passed embedded C2PA validation under the C2PA trust model. Discovery is broad; publication is conservative.</p>
        </div>
      </div>
    </section>

    <section class="app-shell prose-area">
      <h2>Public taxonomy</h2>
      <div class="def-grid">
        <div class="def-card">
          <span class="pill pill-real">Real</span>
          <p>Valid, trusted C2PA manifest with direct digital capture evidence.</p>
        </div>
        <div class="def-card">
          <span class="pill pill-edited">Edited</span>
          <p>Valid, trusted C2PA manifest with edited or provenance-chain evidence back to capture.</p>
        </div>
        <div class="def-card">
          <span class="pill">Excluded: AI</span>
          <p>Valid C2PA evidence of AI-disclosed synthetic media. Hidden from public results unless explicitly requested.</p>
        </div>
        <div class="def-card">
          <span class="pill">Diagnostic</span>
          <p>Invalid, untrusted, no-manifest, unsupported, or stripped assets. Available for audit, never in public search.</p>
        </div>
      </div>

      <h2>How validation works</h2>
      <div class="pipe-grid">
        <div class="pipe-step">
          <strong>Discover</strong>
          <p>Search APIs, Common Crawl, sitemaps, feeds, seeds produce candidate URLs.</p>
        </div>
        <div class="pipe-step">
          <strong>Fetch</strong>
          <p>Public HTTP safety checks, bounded byte limits, prefilter marker scan.</p>
        </div>
        <div class="pipe-step">
          <strong>Validate</strong>
          <p>c2patool verifies the embedded manifest against the C2PA trust list.</p>
        </div>
        <div class="pipe-step">
          <strong>Classify</strong>
          <p>Validator metadata assigns real / edited / excluded / diagnostic; only trusted real and edited enter public search.</p>
        </div>
      </div>

      <h2>Discovery sources</h2>
      <ul class="chips">
        <li>Common Crawl</li>
        <li>search APIs</li>
        <li>sitemaps</li>
        <li>RSS/Atom</li>
        <li>known public repositories</li>
        <li>manual seeds</li>
        <li>platform badge metadata when permitted</li>
        <li>C2PA soft-binding resolvers</li>
      </ul>

      <h2>Limitations</h2>
      <ol class="lim-list">
        <li>Absence of C2PA is unknown, not evidence of AI generation.</li>
        <li>Private, authenticated, blocked, robots-disallowed, unsafe, and unsupported media are outside public coverage claims.</li>
        <li>Marker scanning is a prefilter only; public classification comes from validator metadata.</li>
        <li>Platform-rendered badge summaries, such as public LinkedIn Content Credentials attributes, are stored separately from embedded-manifest validation and remain diagnostic unless the media itself validates.</li>
        <li>Soft-binding recovered manifests remain diagnostic unless the recovered manifest is separately validated and linked back to the asset under the C2PA trust model.</li>
        <li>FotoForensics-hosted assets are treated as analysis-host specimens, not capture-source proof; they stay diagnostic unless surrounding source context explicitly identifies the exact asset as a camera-original or edited example.</li>
      </ol>

      <p class="api-note">Machine-readable version: <a href="/api/methodology">/api/methodology</a>${version ? ' &middot; <span class="mono">' + version + "</span>" : ""}</p>
      <a class="back-link" href="/">Back to search</a>
    </section>
  </main>

  ${siteFooter()}
</body>
</html>`;
}

export interface LandscapeData {
  total: number;
  domains: number;
  firstSeen: string | null;
  lastSeen: string | null;
  classifications: Array<{ classification: string; n: number }>;
  signers: Array<{ signer: string; classification: string; n: number }>;
}

const TRUSTED_CLASSES = new Set(["trusted_camera_capture", "trusted_edited", "ai_disclosed"]);
const UNTRUSTED_MANIFEST_CLASSES = new Set(["c2pa_present_untrusted", "c2pa_present_trusted_non_capture"]);
const INVALID_CLASSES = new Set(["c2pa_invalid"]);

// Validated chart palette (dataviz six-checks / --ordinal):
// funnel ordinal ramp + trusted/untrusted/invalid identity trio + de-emphasis gray.
const RAMP = ["#64acbb", "#4a8b9c", "#3a7384", "#2a4d59"];
const C_TRUSTED = "#059669";
const C_UNTRUSTED = "#1d89a6";
const C_INVALID = "#b91c1c";
const C_NONE = "#94a3b8";

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char] as string);
}

function pct(n: number, d: number): string {
  if (!d) return "0";
  const value = (n / d) * 100;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

function dateOnly(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

const LANDSCAPE_STYLES = `
    .land-hero-figure {
      margin: 18px 0 6px;
      font-size: clamp(64px, 10vw, 112px);
      font-weight: 700;
      letter-spacing: -0.045em;
      line-height: 0.95;
      color: var(--m-slate-900);
    }
    .land-hero-figure sup {
      font-size: 0.38em;
      font-weight: 650;
      color: var(--m-blue-dark);
      letter-spacing: -0.02em;
    }
    .land-hero-sub {
      max-width: 620px;
      color: var(--m-slate-600);
      font-size: 17px;
      line-height: 1.6;
      margin: 0 0 34px;
    }
    .land-hero-sub strong {
      color: var(--m-slate-800);
      font-weight: 650;
    }
    .hero-strip {
      display: flex;
      gap: 2px;
      height: 34px;
      max-width: 860px;
    }
    .hero-strip .seg {
      min-width: 3px;
    }
    .hero-strip .seg:first-child { border-radius: 4px 0 0 4px; }
    .hero-strip .seg:last-child { border-radius: 0 4px 4px 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
    }
    .stat-tile {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      padding: 16px 18px;
    }
    .stat-tile .stat-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--m-slate-600);
    }
    .stat-tile .stat-value {
      margin-top: 8px;
      font-size: 30px;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: var(--m-slate-900);
      line-height: 1.1;
    }
    .stat-tile .stat-sub {
      margin-top: 4px;
      font-size: 12.5px;
      color: var(--m-slate-500);
      line-height: 1.45;
    }
    .chart-note {
      margin: 10px 0 0;
      max-width: 760px;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--m-slate-600);
    }
    .chart-rows {
      display: grid;
      gap: 12px;
      margin-top: 22px;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      min-width: 0;
    }
    .chart-label {
      font-size: 13px;
      color: var(--m-slate-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: right;
    }
    a.chart-label {
      color: var(--m-blue-dark);
      border-bottom: 1px solid transparent;
    }
    a.chart-label:hover {
      border-bottom-color: var(--m-blue);
    }
    .bar-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .bar {
      height: 22px;
      border-radius: 0 4px 4px 0;
      min-width: 2px;
      flex: 0 0 auto;
    }
    .bar-value {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-800);
      white-space: nowrap;
    }
    .bar-value .dim {
      color: var(--m-slate-500);
    }
    .stack {
      display: flex;
      gap: 2px;
      height: 22px;
      flex: 0 0 auto;
    }
    .stack .seg {
      min-width: 3px;
    }
    .stack .seg:last-child { border-radius: 0 4px 4px 0; }
    .stack-wide {
      width: 100%;
      height: 30px;
      max-width: 860px;
      margin-top: 22px;
    }
    .stack-wide .seg:first-child { border-radius: 4px 0 0 4px; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin-top: 14px;
    }
    .legend .key {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-600);
    }
    .legend .swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex: 0 0 auto;
    }
    .chart-table {
      margin-top: 16px;
    }
    .chart-table summary {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-500);
      cursor: pointer;
    }
    .chart-table summary:hover {
      color: var(--m-blue-dark);
    }
    .chart-table table {
      margin-top: 12px;
      border-collapse: collapse;
      font-size: 13px;
    }
    .chart-table th {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--m-slate-500);
      text-align: left;
      padding: 6px 18px 6px 0;
      border-bottom: 1px solid var(--line);
    }
    .chart-table td {
      padding: 7px 18px 7px 0;
      border-bottom: 1px solid var(--m-slate-100);
      color: var(--m-slate-700);
      max-width: 420px;
      overflow-wrap: anywhere;
    }
    .chart-table td.num {
      font-variant-numeric: tabular-nums;
      text-align: right;
      font-family: var(--font-mono);
      font-size: 12.5px;
    }
    .barrier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      counter-reset: barrier;
    }
    .barrier {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 18px;
      background: var(--surface);
      counter-increment: barrier;
    }
    .barrier::before {
      content: counter(barrier, decimal-leading-zero);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--m-blue-dark);
    }
    .barrier h3 {
      margin: 8px 0 8px;
      font-size: 15.5px;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: var(--m-slate-900);
      line-height: 1.3;
    }
    .barrier p {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--m-slate-600);
    }
    .barrier .evidence {
      display: block;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dotted var(--m-slate-300);
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1.5;
      color: var(--m-blue-dark);
    }
    .land-tooltip {
      position: fixed;
      z-index: 60;
      background: var(--m-slate-900);
      color: #ffffff;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.45;
      padding: 7px 10px;
      border-radius: 4px;
      pointer-events: none;
      max-width: 280px;
    }
    @media (max-width: 760px) {
      .chart-row {
        grid-template-columns: 1fr;
        gap: 5px;
      }
      .chart-label {
        text-align: left;
      }
    }`;

export function renderLandscape(data: LandscapeData): string {
  const counts = new Map<string, number>();
  for (const row of data.classifications) counts.set(row.classification, (counts.get(row.classification) ?? 0) + row.n);
  const sumOf = (set: Set<string>) => [...set].reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);

  const total = data.total;
  const trusted = sumOf(TRUSTED_CLASSES);
  const untrusted = sumOf(UNTRUSTED_MANIFEST_CLASSES);
  const invalid = sumOf(INVALID_CLASSES);
  const fetchFailed = counts.get("fetch_failed") ?? 0;
  const manifests = trusted + untrusted + invalid;
  const fetched = Math.max(0, total - fetchFailed);
  const noManifest = Math.max(0, fetched - manifests);
  const failTrust = untrusted + invalid;

  const bySigner = new Map<string, { trusted: number; untrusted: number; invalid: number; total: number }>();
  for (const row of data.signers) {
    const bucket = bySigner.get(row.signer) ?? { trusted: 0, untrusted: 0, invalid: 0, total: 0 };
    if (TRUSTED_CLASSES.has(row.classification)) bucket.trusted += row.n;
    else if (INVALID_CLASSES.has(row.classification)) bucket.invalid += row.n;
    else bucket.untrusted += row.n;
    bucket.total = bucket.trusted + bucket.untrusted + bucket.invalid;
    bySigner.set(row.signer, bucket);
  }
  const rankedSigners = [...bySigner.entries()].sort((a, b) => b[1].total - a[1].total);
  const topSigners = rankedSigners.slice(0, 8);
  const restSigners = rankedSigners.slice(8);
  if (restSigners.length) {
    const other = restSigners.reduce(
      (sum, [, b]) => ({ trusted: sum.trusted + b.trusted, untrusted: sum.untrusted + b.untrusted, invalid: sum.invalid + b.invalid, total: sum.total + b.total }),
      { trusted: 0, untrusted: 0, invalid: 0, total: 0 },
    );
    topSigners.push([`Other signers (${restSigners.length})`, other]);
  }
  const maxSignerTotal = Math.max(1, ...topSigners.map(([, b]) => b.total));

  const funnel = [
    { label: "Crawled candidates", n: total, color: RAMP[0], tip: `${total} candidate images discovered across ${data.domains} domains` },
    { label: "Fetched & scanned", n: fetched, color: RAMP[1], tip: `${fetched} fetched successfully (${fetchFailed} unreachable)` },
    { label: "C2PA manifest present", n: manifests, color: RAMP[2], tip: `${manifests} carried an embedded C2PA manifest (${pct(manifests, total)}% of crawled)` },
    { label: "Trusted & valid", n: trusted, color: RAMP[3], tip: `${trusted} validated against the C2PA trust list (${pct(trusted, total)}% of crawled)` },
  ];
  const maxFunnel = Math.max(1, total);

  const stripSegs = [
    { label: "No manifest recovered", n: noManifest, color: C_NONE },
    { label: "Untrusted certificate", n: untrusted, color: C_UNTRUSTED },
    { label: "Invalid manifest", n: invalid, color: C_INVALID },
    { label: "Trusted & valid", n: trusted, color: C_TRUSTED },
  ].filter((seg) => seg.n > 0);

  const seg = (label: string, n: number, denom: number, color: string) =>
    `<div class="seg" role="img" style="flex-basis:${((n / Math.max(1, denom)) * 100).toFixed(2)}%;background:${color}" data-tip="${esc(label)}: ${n} (${pct(n, denom)}%)" aria-label="${esc(label)}: ${n} of ${denom}"></div>`;

  const funnelRows = funnel
    .map(
      (stage) => `<div class="chart-row">
          <span class="chart-label">${esc(stage.label)}</span>
          <div class="bar-cell">
            <div class="bar" role="img" style="width:calc((100% - 96px) * ${(stage.n / maxFunnel).toFixed(4)});background:${stage.color}" data-tip="${esc(stage.tip)}" aria-label="${esc(stage.tip)}"></div>
            <span class="bar-value">${stage.n} <span class="dim">· ${pct(stage.n, total)}%</span></span>
          </div>
        </div>`,
    )
    .join("\n        ");

  const signerRows = topSigners
    .map(([name, b]) => {
      const isOther = name.startsWith("Other signers");
      const label = isOther
        ? `<span class="chart-label" title="${esc(name)}">${esc(name)}</span>`
        : `<a class="chart-label" href="/?q=${encodeURIComponent(name)}" title="Search ${esc(name)}">${esc(name)}</a>`;
      return `<div class="chart-row">
          ${label}
          <div class="bar-cell">
            <div class="stack" style="width:calc((100% - 56px) * ${(b.total / maxSignerTotal).toFixed(4)})">
              ${b.trusted ? seg("Trusted & valid", b.trusted, b.total, C_TRUSTED) : ""}
              ${b.untrusted ? seg("Untrusted certificate", b.untrusted, b.total, C_UNTRUSTED) : ""}
              ${b.invalid ? seg("Invalid manifest", b.invalid, b.total, C_INVALID) : ""}
            </div>
            <span class="bar-value">${b.total}</span>
          </div>
        </div>`;
    })
    .join("\n        ");

  const signerTableRows = rankedSigners
    .slice(0, 12)
    .map(([name, b]) => `<tr><td>${esc(name)}</td><td class="num">${b.trusted}</td><td class="num">${b.untrusted}</td><td class="num">${b.invalid}</td><td class="num">${b.total}</td></tr>`)
    .join("");

  const legendTrio = `<div class="legend" role="list">
        <span class="key" role="listitem"><span class="swatch" style="background:${C_TRUSTED}"></span>Trusted &amp; valid</span>
        <span class="key" role="listitem"><span class="swatch" style="background:${C_UNTRUSTED}"></span>Untrusted certificate</span>
        <span class="key" role="listitem"><span class="swatch" style="background:${C_INVALID}"></span>Invalid manifest</span>
      </div>`;

  const window = data.firstSeen && data.lastSeen ? `${dateOnly(data.firstSeen)} → ${dateOnly(data.lastSeen)}` : "ongoing";

  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead("C2PA ecosystem landscape · mutual C2PA Search", "How much of the public web's imagery carries trusted C2PA provenance, measured by continuous crawling and validation.", "/landscape")}
  <style>${SHARED_STYLES}
${LANDSCAPE_STYLES}
  </style>
</head>
<body>
  ${siteHeader()}

  <main>
    <section class="hero-band">
      <div class="app-shell hero-inner hero-inner-compact">
        <div class="hero-copy">
          <div class="section-label-mono">C2PA ecosystem &middot; measured from the public web</div>
          <div class="land-hero-figure">${pct(trusted, total)}<sup>%</sup></div>
          <p class="land-hero-sub">of the <strong>${total} candidate images</strong> this hub has crawled and validated carry a <strong>trusted, valid C2PA manifest</strong>. The rest of the strip is what the provenance ecosystem actually looks like today.</p>
        </div>
        <div class="hero-strip" role="img" aria-label="Distribution of ${total} crawled images by provenance outcome">
          ${stripSegs.map((s) => seg(s.label, s.n, total, s.color)).join("\n          ")}
        </div>
        <div class="legend">
          <span class="key"><span class="swatch" style="background:${C_NONE}"></span>No manifest recovered</span>
          <span class="key"><span class="swatch" style="background:${C_UNTRUSTED}"></span>Untrusted certificate</span>
          <span class="key"><span class="swatch" style="background:${C_INVALID}"></span>Invalid manifest</span>
          <span class="key"><span class="swatch" style="background:${C_TRUSTED}"></span>Trusted &amp; valid</span>
        </div>
      </div>
    </section>

    <section class="app-shell prose-area">
      <div class="kpi-row">
        <div class="stat-tile">
          <div class="stat-label">Crawled candidates</div>
          <div class="stat-value">${total}</div>
          <div class="stat-sub">across ${data.domains} domains, ${esc(window)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Manifests found</div>
          <div class="stat-value">${manifests}</div>
          <div class="stat-sub">${pct(manifests, total)}% of crawled candidates</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Fail trust validation</div>
          <div class="stat-value">${failTrust}</div>
          <div class="stat-sub">${pct(failTrust, manifests)}% of manifests found</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Trusted &amp; valid</div>
          <div class="stat-value">${trusted}</div>
          <div class="stat-sub">${pct(trusted, total)}% of everything crawled</div>
        </div>
      </div>

      <h2>The provenance funnel</h2>
      <p class="chart-note">Every stage loses most of what enters it. Candidates come from targeted search, Common Crawl probes, sitemaps, feeds, and community seeds. All of those are already biased <em>toward</em> C2PA content, so the open web at large fares worse than this.</p>
      <div class="chart-rows">
        ${funnelRows}
      </div>
      <details class="chart-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th scope="col">Stage</th><th scope="col">Images</th><th scope="col">% of crawled</th></tr></thead>
          <tbody>
            ${funnel.map((stage) => `<tr><td>${esc(stage.label)}</td><td class="num">${stage.n}</td><td class="num">${pct(stage.n, total)}%</td></tr>`).join("")}
          </tbody>
        </table>
      </details>

      <h2>The trust gap</h2>
      <p class="chart-note"><strong>${pct(failTrust, manifests)}% of the manifests we found do not validate against the C2PA trust list.</strong> Most carry self-signed or test certificates: tools that implemented the spec but never got, or never deployed, a trusted signing credential. To a verifier these images are no more credible than unsigned ones.</p>
      <div class="stack stack-wide">
        ${trusted ? seg("Trusted & valid", trusted, manifests, C_TRUSTED) : ""}
        ${untrusted ? seg("Untrusted certificate", untrusted, manifests, C_UNTRUSTED) : ""}
        ${invalid ? seg("Invalid manifest", invalid, manifests, C_INVALID) : ""}
      </div>
      ${legendTrio}
      <details class="chart-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th scope="col">Validation outcome</th><th scope="col">Manifests</th><th scope="col">% of manifests</th></tr></thead>
          <tbody>
            <tr><td>Trusted &amp; valid</td><td class="num">${trusted}</td><td class="num">${pct(trusted, manifests)}%</td></tr>
            <tr><td>Untrusted certificate</td><td class="num">${untrusted}</td><td class="num">${pct(untrusted, manifests)}%</td></tr>
            <tr><td>Invalid manifest</td><td class="num">${invalid}</td><td class="num">${pct(invalid, manifests)}%</td></tr>
          </tbody>
        </table>
      </details>

      <h2>Who signs the public web</h2>
      <p class="chart-note">Signer names as recorded in the manifests we validated. Development and test signers outnumber production credentials; trusted capture in the wild is dominated by a handful of device signers. Click a signer to search its images.</p>
      <div class="chart-rows">
        ${signerRows}
      </div>
      ${legendTrio}
      <details class="chart-table">
        <summary>View as table (top 12)</summary>
        <table>
          <thead><tr><th scope="col">Signer</th><th scope="col">Trusted</th><th scope="col">Untrusted</th><th scope="col">Invalid</th><th scope="col">Total</th></tr></thead>
          <tbody>${signerTableRows}</tbody>
        </table>
      </details>

      <h2>Why adoption is stuck</h2>
      <div class="barrier-grid">
        <div class="barrier">
          <h3>Signing at capture is rare and gated</h3>
          <p>Only a handful of consumer devices sign by default. Camera-vendor rollouts have stalled, shipped on legacy spec versions, restricted signing to enterprise programs, or had certificates revoked after compromise.</p>
          <span class="evidence">measured: ${trusted} trusted captures in ${total} crawled candidates</span>
        </div>
        <div class="barrier">
          <h3>Conformant does not mean trusted</h3>
          <p>A product can implement the spec, even pass conformance, and still ship self-signed or test certificates. Verifiers refuse to trust those, so all that work buys no credibility. Free claim-signing certificates (announced June 2026) may finally close this gap.</p>
          <span class="evidence">measured: ${untrusted} of ${manifests} manifests carry untrusted certificates</span>
        </div>
        <div class="barrier">
          <h3>Distribution strips provenance</h3>
          <p>Most platforms and CDNs re-encode uploads and discard metadata, so a signed image usually arrives at its audience without its manifest. Some platforms display their own provenance badges server-side while serving stripped bytes.</p>
          <span class="evidence">measured: ${noManifest} of ${fetched} fetched images had no recoverable manifest</span>
        </div>
        <div class="barrier">
          <h3>Validation is unforgiving by design</h3>
          <p>Correct verification needs current trust lists, timestamp-authority configuration, and tolerance for short-lived signing certificates that rotate every few months. A naively configured validator reports genuine captures as expired or untrusted.</p>
          <span class="evidence">observed: 90-day signing certificates in the wild; ${invalid} manifests fail validation outright</span>
        </div>
        <div class="barrier">
          <h3>Absence proves nothing</h3>
          <p>C2PA can prove where a signed image came from. It cannot prove an unsigned image is fake. Until signing is the default, missing provenance is just the normal state of the web, and a stripped image looks exactly like one that was never signed.</p>
          <span class="evidence">measured: ${pct(noManifest, total)}% of the crawl is in that indistinguishable state</span>
        </div>
      </div>

      <p class="api-note">Continuously measured by this hub's crawler (${esc(window)}). Method: <a href="/methodology">/methodology</a> &middot; raw data: <a href="/api/export.json?include_diagnostics=true">export.json?include_diagnostics=true</a> &middot; corpus totals: <a href="/api/stats">/api/stats</a></p>
      <a class="back-link" href="/">Back to search</a>
    </section>
  </main>

  ${siteFooter()}

  <script>
    const tip = document.createElement("div");
    tip.className = "land-tooltip";
    tip.hidden = true;
    document.body.appendChild(tip);
    function moveTip(event) {
      const pad = 14;
      const x = Math.min(event.clientX + pad, window.innerWidth - tip.offsetWidth - pad);
      const y = Math.min(event.clientY + pad, window.innerHeight - tip.offsetHeight - pad);
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }
    document.addEventListener("mousemove", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
      if (!target) {
        tip.hidden = true;
        return;
      }
      tip.textContent = target.getAttribute("data-tip");
      tip.hidden = false;
      moveTip(event);
    });
    document.addEventListener("mouseleave", () => { tip.hidden = true; });
  </script>
</body>
</html>`;
}

export interface LibraryAsset {
  id: number;
  url: string;
  domain: string | null;
  public_category: string;
  classification: string | null;
  signer: string | null;
  claim_generator: string | null;
  content_type: string | null;
  latest_validated_at: string | null;
  cached_object_key: string | null;
}

export interface LibraryFilters {
  signer: string | null;
  category: string | null;
}

const LIBRARY_STYLES = `
    .lib-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0 0 22px;
    }
    .lib-toolbar .lib-group {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--m-slate-500);
      margin-right: 4px;
    }
    .lib-chip {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--m-slate-600);
      border: 1px solid var(--line);
      border-radius: 100px;
      padding: 6px 12px;
      background: var(--surface);
      transition: color 130ms ease, border-color 130ms ease, background 130ms ease;
    }
    .lib-chip:hover {
      color: var(--m-blue-dark);
      border-color: var(--m-blue);
    }
    .lib-chip.active {
      color: #ffffff;
      background: var(--m-blue-dark);
      border-color: var(--m-blue-dark);
    }
    .lib-card-actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid var(--m-slate-200);
      padding-top: 11px;
    }
    .lib-empty {
      border: 1px dashed var(--m-slate-300);
      border-radius: 6px;
      padding: 44px 24px;
      text-align: center;
      color: var(--m-slate-600);
      font-size: 14px;
    }`;

function libraryRow(label: string, value: string): string {
  return `<div class="row"><span class="label">${esc(label)}</span><span class="leader" aria-hidden="true"></span><span class="value">${esc(value)}</span></div>`;
}

function libraryDisplayUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const tail = parts.length ? decodeURIComponent(parts[parts.length - 1]) : "";
    const host = url.hostname.replace(/^www\./, "");
    return tail ? `${host} / ${tail}` : host;
  } catch {
    return raw;
  }
}

export function renderAssetsLibrary(assets: LibraryAsset[], signers: Array<{ signer: string; n: number }>, filters: LibraryFilters): string {
  const chip = (label: string, href: string, active: boolean) =>
    `<a class="lib-chip${active ? " active" : ""}" href="${esc(href)}">${esc(label)}</a>`;

  const signerChips = signers
    .slice(0, 10)
    .map((s) => chip(`${s.signer} (${s.n})`, `/assets?signer=${encodeURIComponent(s.signer)}${filters.category ? `&category=${esc(filters.category)}` : ""}`, filters.signer === s.signer))
    .join("\n          ");

  const categoryChips = [
    chip("All", filters.signer ? `/assets?signer=${encodeURIComponent(filters.signer)}` : "/assets", !filters.category),
    chip("Real", `/assets?category=real${filters.signer ? `&signer=${encodeURIComponent(filters.signer)}` : ""}`, filters.category === "real"),
    chip("Edited", `/assets?category=edited${filters.signer ? `&signer=${encodeURIComponent(filters.signer)}` : ""}`, filters.category === "edited"),
  ].join("\n          ");

  const cards = assets
    .map((asset) => {
      const category = asset.public_category === "edited" ? "edited" : "real";
      const download = asset.cached_object_key
        ? `<a class="text-button" href="/api/image/${asset.id}" download>Download original</a>`
        : `<span class="footer-note" title="No cached copy; fetch from the source URL">source only</span>`;
      return `<article class="item">
          <div class="thumb"><img src="/api/image/${asset.id}" loading="lazy" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-empty');this.remove()"><span class="thumb-label">C2PA</span></div>
          <div class="meta">
            <div class="card-kicker"><span class="pill pill-${category}">${category === "edited" ? "Edited" : "Real"}</span><span class="classification">${esc((asset.classification ?? "validated").replace(/_/g, " "))}</span></div>
            <a class="url" href="${esc(asset.url)}" rel="noreferrer" target="_blank">${esc(libraryDisplayUrl(asset.url))}</a>
            <div class="facts">
              ${libraryRow("Signer", asset.signer ?? "unknown")}
              ${libraryRow("Generator", asset.claim_generator ?? "unknown")}
              ${libraryRow("Type", asset.content_type ?? "unknown")}
            </div>
            <div class="lib-card-actions">
              <a class="text-button detail-link" href="/?asset=${asset.id}">Full record</a>
              ${download}
            </div>
          </div>
        </article>`;
    })
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead("Test assets · mutual C2PA Search", "Validated C2PA sample images with intact manifests: filter by signer, download originals, deep-link full provenance records.", "/assets")}
  <style>${SHARED_STYLES}
${LIBRARY_STYLES}
  </style>
</head>
<body>
  ${siteHeader()}

  <main>
    <section class="hero-band">
      <div class="app-shell hero-inner hero-inner-compact">
        <div class="hero-copy">
          <div class="section-label-mono">Test assets</div>
          <h1>Validated samples, manifests intact.</h1>
          <p>Every image here passed embedded C2PA validation, and downloads serve the exact bytes we validated. Chat apps and social platforms strip manifests on upload; nothing here does. Point your validator at them.</p>
        </div>
      </div>
    </section>

    <section class="app-shell results-area">
      <div class="lib-toolbar">
        <span class="lib-group">Category</span>
        ${categoryChips}
      </div>
      <div class="lib-toolbar">
        <span class="lib-group">Signer</span>
          ${signerChips}
      </div>

      ${assets.length ? `<div class="grid">\n        ${cards}\n      </div>` : `<div class="lib-empty">No validated assets match this filter yet.</div>`}

      <p class="api-note">Programmatic access: <a href="/api/assets">/api/assets</a> (same filters as this page) &middot; <a href="/api/export.json">export.json</a> &middot; single record: <a href="/api/assets/1">/api/assets/:id</a>. Missing a signer you need? <a href="/">Queue a public source</a> and it will be validated into the corpus.</p>
      <a class="back-link" href="/">Back to search</a>
    </section>
  </main>

  ${siteFooter()}
</body>
</html>`;
}

const RESOURCE_SECTIONS: Array<{ title: string; note: string; links: Array<{ name: string; url: string; desc: string }> }> = [
  {
    title: "Verify an image",
    note: "Independent viewers that read and validate Content Credentials. We link the best tools instead of rebuilding them.",
    links: [
      { name: "C2PA Viewer", url: "https://c2paviewer.com/", desc: "Community-built manifest viewer: drop a file, inspect assertions, signatures, and validation status." },
      { name: "CAI Verify", url: "https://verify.contentauthenticity.org/", desc: "The Content Authenticity Initiative's official verify tool." },
      { name: "c2patool", url: "https://github.com/contentauth/c2pa-rs/tree/main/cli", desc: "Reference CLI validator. Load current trust settings to avoid false 'untrusted' results on genuine captures." },
    ],
  },
  {
    title: "Specification & conformance",
    note: "The source of truth for what a valid manifest is and who is conformant.",
    links: [
      { name: "C2PA specifications", url: "https://spec.c2pa.org/", desc: "Current technical specification, security considerations, and guidance." },
      { name: "Conformance explorer", url: "https://spec.c2pa.org/conformance-explorer/", desc: "Official list of conformant generator products and assurance levels." },
      { name: "Conformance program", url: "https://c2pa.org/conformance/", desc: "How products get certified, and what conformance does and does not guarantee." },
    ],
  },
  {
    title: "Build with C2PA",
    note: "SDKs and signing infrastructure.",
    links: [
      { name: "c2pa-rs", url: "https://github.com/contentauth/c2pa-rs", desc: "Reference Rust implementation with bindings; powers most tooling including our validator." },
      { name: "Mobile SDKs", url: "https://opensource.contentauthenticity.org/docs/mobile/", desc: "Official iOS and Android libraries for capture-time signing." },
      { name: "SSL.com C2PA certificates", url: "https://www.ssl.com/c2pa/", desc: "Trusted claim-signing certificates, including a free tier for conformant generators (June 2026)." },
      { name: "CAWG identity", url: "https://cawg.io/", desc: "Creator Assertions Working Group: attach verified creator identity on top of C2PA." },
    ],
  },
  {
    title: "Sample assets",
    note: "Signed files for testing validators and pipelines.",
    links: [
      { name: "Our test-asset library", url: "/assets", desc: "Crawled, validated samples with intact manifests, filterable by signer. Grows as the crawler runs." },
      { name: "contentauth/example-assets", url: "https://github.com/contentauth/example-assets", desc: "Community repository of signed reference assets." },
      { name: "Proofmode Baseline", url: "https://proofmode.org/baseline/", desc: "Guardian Project's public capture-sample repository." },
    ],
  },
  {
    title: "Data from this hub",
    note: "Everything we measure is exportable and free to cite.",
    links: [
      { name: "Ecosystem landscape", url: "/landscape", desc: "Live charts: the provenance funnel, the trust gap, and who signs the public web." },
      { name: "Full corpus export", url: "/api/export.json?include_diagnostics=true", desc: "Machine-readable dump including diagnostics; CSV also available." },
      { name: "Soft-binding resolver", url: "/api/methodology", desc: "SHA-256 and reference-URL manifest recovery for the indexed corpus (see methodology)." },
    ],
  },
];

export function renderResources(): string {
  const sections = RESOURCE_SECTIONS.map(
    (section) => `<h2>${esc(section.title)}</h2>
      <p class="chart-note">${esc(section.note)}</p>
      <div class="def-grid">
        ${section.links
          .map(
            (link) => `<a class="def-card resource-card" href="${esc(link.url)}"${link.url.startsWith("http") ? ' rel="noreferrer" target="_blank"' : ""}>
          <strong>${esc(link.name)}${link.url.startsWith("http") ? " ↗" : ""}</strong>
          <p>${esc(link.desc)}</p>
        </a>`,
          )
          .join("\n        ")}
      </div>`,
  ).join("\n\n      ");

  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead("Resources · mutual C2PA Search", "A working directory for people building on C2PA: verification tools, specs, SDKs, signing certificates, and sample assets.", "/resources")}
  <style>${SHARED_STYLES}
    .resource-card strong {
      font-size: 14.5px;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: var(--m-blue-dark);
    }
    .resource-card:hover {
      border-color: rgba(74, 139, 156, 0.5);
    }
    .chart-note {
      margin: 10px 0 18px;
      max-width: 760px;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--m-slate-600);
    }
  </style>
</head>
<body>
  ${siteHeader()}

  <main>
    <section class="hero-band">
      <div class="app-shell hero-inner hero-inner-compact">
        <div class="hero-copy">
          <div class="section-label-mono">Resources</div>
          <h1>A working directory for people building on C2PA.</h1>
          <p>The best existing tool for each job, linked, plus the data only this hub measures. Know something that belongs here? <a href="https://mutual.solutions/" rel="noreferrer">Tell us</a>.</p>
        </div>
      </div>
    </section>

    <section class="app-shell prose-area">
      ${sections}
      <a class="back-link" href="/">Back to search</a>
    </section>
  </main>

  ${siteFooter()}
</body>
</html>`;
}

export function renderAssetForTest(asset: Record<string, unknown>): string {
  return renderAssetImage(asset);
}

function renderAssetImage(asset: Record<string, unknown>): string {
  if (!isRenderableImageAsset(asset)) return "C2PA";
  return "<img src=\"/api/image/" + encodeURIComponent(String(asset.id)) + "\" loading=\"lazy\" referrerpolicy=\"no-referrer\" onerror=\"this.parentElement.textContent='C2PA'\">";
}

function isRenderableImageAsset(asset: Record<string, unknown>): boolean {
  const contentType = String(asset.content_type || "").toLowerCase();
  const lowerUrl = String(asset.url || "").toLowerCase();
  return (
    contentType.startsWith("image/") ||
    isFotoForensicsOriginal(lowerUrl) ||
    /\.(avif|gif|jpe?g|png|webp)(\?|$)/.test(lowerUrl)
  );
}

function isFotoForensicsOriginal(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "fotoforensics.com" || url.hostname === "www.fotoforensics.com") &&
      url.pathname === "/analysis.php" &&
      url.searchParams.get("fmt") === "orig"
    );
  } catch {
    return false;
  }
}
