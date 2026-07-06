// UI verification harness for c2pa-scanner
// Run via: npm run verify:ui
// Requires node 22+ (--experimental-strip-types for ../src/ui.ts import)

import { renderHome, renderLandscape, renderMethodology } from '../src/ui.ts';
import { chromium } from 'playwright';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- stub data (mirrors gen-preview3.mjs) ----
function asset(id, cat, signer, gen) {
  return {
    id,
    public_category: cat,
    classification: cat === 'real' ? 'trusted_camera_capture' : 'trusted_edited',
    url: `https://example-${id}.com/photos/sample-${id}.jpg`,
    domain: `example-${id}.com`,
    signer,
    claim_generator: gen,
    latest_validated_at: `2026-06-${String(10 + id).padStart(2, '0')}T09:15:00Z`,
    content_type: 'text/html',
  };
}

const PAGE1 = {
  assets: [
    asset(1, 'real', 'Leica Camera AG', 'Leica M11-P'),
    asset(2, 'real', 'Nikon Corporation', 'Nikon Z9'),
    asset(3, 'edited', 'Adobe Inc.', 'Adobe Photoshop 26.4'),
    asset(4, 'real', 'Sony Group Corporation', 'Sony a1 II'),
    asset(5, 'edited', 'Adobe Inc.', 'Adobe Lightroom 8.2'),
    asset(6, 'real', 'Truepic Inc.', 'Truepic Lens 4.1'),
  ],
  next_cursor: 'CURSOR1',
};
const PAGE2 = {
  assets: [
    asset(7, 'real', 'Canon Inc.', 'Canon R1'),
    asset(8, 'real', 'Samsung Electronics', 'Galaxy S26 Ultra'),
  ],
  next_cursor: null,
};
const STATS = { real_count: 42, edited_count: 17, last_validated_at: '2026-07-05T21:30:00Z' };

const fetchStub = `<script>
window.fetch = (u) => {
  const url = String(u);
  let payload = {};
  if (url.includes('/api/stats')) payload = ${JSON.stringify(STATS)};
  else if (url.includes('/api/assets')) payload = url.includes('cursor=') ? ${JSON.stringify(PAGE2)} : ${JSON.stringify(PAGE1)};
  return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
};
</` + `script>`;

// ---- write temp HTML files ----
const tmpDir = mkdtempSync(join(tmpdir(), 'c2pa-verify-'));
const homeHtml = renderHome().replace('<script>', fetchStub + '\n  <script>');
writeFileSync(join(tmpDir, 'home.html'), homeHtml);
writeFileSync(join(tmpDir, 'methodology.html'), renderMethodology('c2pa-hub-v2-2026-06-27'));

const LANDSCAPE = {
  total: 437,
  domains: 38,
  firstSeen: '2026-06-27T08:24:40.093Z',
  lastSeen: '2026-07-05T00:17:55.539Z',
  classifications: [
    { classification: 'stripped_or_unknown', n: 341 },
    { classification: 'c2pa_present_untrusted', n: 72 },
    { classification: 'c2pa_invalid', n: 10 },
    { classification: 'trusted_camera_capture', n: 7 },
    { classification: 'trusted_edited', n: 4 },
    { classification: 'fetch_failed', n: 3 },
  ],
  signers: [
    { signer: 'C2PA Signer', classification: 'c2pa_present_untrusted', n: 13 },
    { signer: 'C2PA Signer', classification: 'c2pa_invalid', n: 7 },
    { signer: 'Pixel Camera', classification: 'trusted_camera_capture', n: 5 },
    { signer: 'Adobe C2PA', classification: 'c2pa_present_untrusted', n: 9 },
  ],
};
writeFileSync(join(tmpDir, 'landscape.html'), renderLandscape(LANDSCAPE));

const homeUrl = 'file://' + join(tmpDir, 'home.html');
const methodologyUrl = 'file://' + join(tmpDir, 'methodology.html');
const landscapeUrl = 'file://' + join(tmpDir, 'landscape.html');

// ---- load axe-core ----
const axeSource = readFileSync(
  fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url)),
  'utf8',
);

// ---- pass/fail tracking ----
const checks = [];
function pass(name) {
  checks.push({ name, ok: true });
  console.log('PASS  ' + name);
}
function fail(name, reason) {
  checks.push({ name, ok: false, reason });
  console.log('FAIL  ' + name);
  console.log('      ' + reason);
}

// ---- run checks ----
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // --- initial load (page 1 data: 6 cards) ---
  await page.goto(homeUrl);
  await page.waitForTimeout(2000);

  // (a) stat strip visible with correct numbers
  const statsInfo = await page.evaluate(() => ({
    hidden: document.querySelector('#stats').hidden,
    real: document.querySelector('#stat-real').textContent.trim(),
    edited: document.querySelector('#stat-edited').textContent.trim(),
  }));
  if (!statsInfo.hidden && statsInfo.real === '42' && statsInfo.edited === '17') {
    pass('(a) stat strip visible with real=42 edited=17');
  } else {
    fail('(a) stat strip visible with real=42 edited=17', JSON.stringify(statsInfo));
  }

  // (b) 6 cards → click #load-more → 8 cards and button hidden
  const cardsBefore = await page.evaluate(() => document.querySelectorAll('.item').length);
  if (cardsBefore === 6) {
    await page.click('#load-more');
    await page.waitForTimeout(800);
    const afterLoad = await page.evaluate(() => ({
      cards: document.querySelectorAll('.item').length,
      buttonHidden: document.querySelector('#load-more').hidden,
    }));
    if (afterLoad.cards === 8 && afterLoad.buttonHidden) {
      pass('(b) 6 cards → load-more → 8 cards, button hidden');
    } else {
      fail('(b) 6 cards → load-more → 8 cards, button hidden', JSON.stringify(afterLoad));
    }
  } else {
    fail('(b) 6 cards → load-more → 8 cards, button hidden', `initial card count: ${cardsBefore}`);
  }

  // (c) URL restore: ?q=Adobe&category=edited → input=Adobe, edited tab aria-selected=true
  await page.goto(homeUrl + '?q=Adobe&category=edited');
  await page.waitForTimeout(1500);
  const restore = await page.evaluate(() => ({
    q: document.querySelector('#query').value,
    editedSelected: document.querySelector('#tab-edited').getAttribute('aria-selected'),
  }));
  if (restore.q === 'Adobe' && restore.editedSelected === 'true') {
    pass('(c) URL restore: input=Adobe, edited tab aria-selected=true');
  } else {
    fail('(c) URL restore: input=Adobe, edited tab aria-selected=true', JSON.stringify(restore));
  }

  // --- fresh load for dialog + filter checks ---
  await page.goto(homeUrl);
  await page.waitForTimeout(1500);

  // (d) detail dialog: click .detail-button → dialog open with 8 fact rows
  await page.click('.detail-button');
  await page.waitForTimeout(400);
  const dialogOpen = await page.evaluate(() => ({
    open: document.querySelector('#detail').open,
    factRows: document.querySelectorAll('#detail-facts .row').length,
  }));
  if (dialogOpen.open && dialogOpen.factRows === 8) {
    pass('(d) detail dialog opens with 8 fact rows');
  } else {
    fail('(d) detail dialog opens with 8 fact rows', JSON.stringify(dialogOpen));
  }

  // (g-a) axe scan: home with dialog OPEN
  await page.addScriptTag({ content: axeSource });
  const axeHomeViolations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }));
  });
  if (axeHomeViolations.length === 0) {
    pass('(g) axe: 0 serious/critical violations on home (dialog open)');
  } else {
    fail('(g) axe: 0 serious/critical violations on home (dialog open)', JSON.stringify(axeHomeViolations));
  }

  // (d-close) Escape closes dialog, focus returns to trigger
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const afterClose = await page.evaluate(() => ({
    open: document.querySelector('#detail').open,
    focusOnDetailButton: document.activeElement.classList.contains('detail-button'),
  }));
  if (!afterClose.open && afterClose.focusOnDetailButton) {
    pass('(d) Escape closes dialog and focus returns to trigger');
  } else {
    fail('(d) Escape closes dialog and focus returns to trigger', JSON.stringify(afterClose));
  }

  // (e) click .value-filter → input populated + URL has q=
  await page.click('.value-filter');
  await page.waitForTimeout(800);
  const filterResult = await page.evaluate(() => ({
    q: document.querySelector('#query').value,
    urlHasQ: location.search.includes('q='),
  }));
  if (filterResult.q && filterResult.urlHasQ) {
    pass('(e) value-filter click: input populated and URL contains q=');
  } else {
    fail('(e) value-filter click: input populated and URL contains q=', JSON.stringify(filterResult));
  }

  // (f) zero pageerror events (collected throughout all navigations above)
  if (pageErrors.length === 0) {
    pass('(f) zero pageerror events');
  } else {
    fail('(f) zero pageerror events', JSON.stringify(pageErrors));
  }

  // (g-b) axe scan: methodology page
  const methPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await methPage.goto(methodologyUrl);
  await methPage.waitForTimeout(1000);
  await methPage.addScriptTag({ content: axeSource });
  const axeMethViolations = await methPage.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }));
  });
  if (axeMethViolations.length === 0) {
    pass('(g) axe: 0 serious/critical violations on methodology page');
  } else {
    fail('(g) axe: 0 serious/critical violations on methodology page', JSON.stringify(axeMethViolations));
  }
  await methPage.close();

  // (h) landscape page: tooltip layer, table twin, axe
  const landPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const landErrors = [];
  landPage.on('pageerror', (e) => landErrors.push(String(e)));
  await landPage.goto(landscapeUrl);
  await landPage.waitForTimeout(1000);
  await landPage.locator('.chart-rows .bar').first().hover();
  await landPage.waitForTimeout(300);
  const landTip = await landPage.evaluate(() => {
    const t = document.querySelector('.land-tooltip');
    return t && !t.hidden && t.textContent.length > 0;
  });
  if (landTip) {
    pass('(h) landscape: hover tooltip shows on funnel bar');
  } else {
    fail('(h) landscape: hover tooltip shows on funnel bar', 'tooltip hidden or empty');
  }
  await landPage.click('.chart-table summary');
  const landTable = await landPage.evaluate(() => !!document.querySelector('.chart-table[open] table'));
  if (landTable) {
    pass('(h) landscape: table twin opens');
  } else {
    fail('(h) landscape: table twin opens', 'details did not open');
  }
  await landPage.addScriptTag({ content: axeSource });
  const axeLandViolations = await landPage.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }));
  });
  if (axeLandViolations.length === 0 && landErrors.length === 0) {
    pass('(h) axe: 0 serious/critical violations on landscape page, zero pageerrors');
  } else {
    fail('(h) axe: 0 serious/critical violations on landscape page, zero pageerrors', JSON.stringify({ axeLandViolations, landErrors }));
  }
  await landPage.close();
} finally {
  await browser.close();
}

// ---- summary ----
const failed = checks.filter((c) => !c.ok).length;
console.log('\n=== verify:ui summary ===');
console.log(checks.length + ' checks, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
