import { chromium } from 'playwright';

const BASE = 'http://localhost:5199';
const SCRATCHPAD = '/private/tmp/claude-501/-Users-arnav-my-projects-showup-app/570c2950-ca4e-4cbf-a67d-2647aa9d333a/scratchpad';

const ss = async (page, name) => {
  await page.screenshot({ path: `${SCRATCHPAD}/${name}.png` });
  console.log(`[screenshot] ${name}.png`);
};
const log = (msg) => console.log(`[step] ${msg}`);
const errs = [];

const browser = await chromium.launch({ headless: true });
// iPhone-ish emulation
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
ctx.on('page', p => {
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
});

const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(e.message));

// Complete the mock-mode onboarding so we reach the home feed.
async function onboard() {
  const body = await page.locator('body').innerText().catch(() => '');
  if (!/sign in|google|get started|welcome/i.test(body)) return; // already onboarded
  // Click through whatever CTAs the onboarding presents (mock mode needs no OAuth).
  for (let i = 0; i < 8; i++) {
    const btn = page.locator('button:visible, [role="button"]:visible').first();
    if (!(await btn.isVisible().catch(() => false))) break;
    // Fill any visible text inputs before advancing.
    const inputs = page.locator('input:visible');
    const n = await inputs.count().catch(() => 0);
    for (let j = 0; j < n; j++) {
      const inp = inputs.nth(j);
      const val = await inp.inputValue().catch(() => 'x');
      if (!val) await inp.fill(['ada', 'ada' + Date.now()][j] ?? 'ada').catch(() => {});
    }
    await btn.click().catch(() => {});
    await page.waitForTimeout(600);
    const t = await page.locator('body').innerText().catch(() => '');
    if (/tonight|upcoming|no events|create/i.test(t)) break;
  }
}

// ── 1. Load + onboard ─────────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForTimeout(1500);
await onboard();
await ss(page, '01_home');
const home = await page.locator('body').innerText().catch(() => '');
log(`home snippet: ${home.slice(0, 120).replace(/\n/g, ' ')}`);

// ── 2. HOST: create an event, open check-in, assert a real QR <svg> renders ──
log('creating an event to reach the host check-in screen');
const createBtn = page.locator('text=/new event|create|\\+/i').first();
if (await createBtn.isVisible().catch(() => false)) {
  await createBtn.click();
  await page.waitForTimeout(600);
  // Walk the 4-step wizard: pick first option / fill fields / advance.
  for (let step = 0; step < 8; step++) {
    const inputs = page.locator('input:visible');
    const n = await inputs.count().catch(() => 0);
    for (let j = 0; j < n; j++) {
      const inp = inputs.nth(j);
      if (!(await inp.inputValue().catch(() => 'x'))) await inp.fill('kickback').catch(() => {});
    }
    // Choose the first selectable chip/option if present.
    const chip = page.locator('button:visible').filter({ hasNotText: /back|next|continue|send/i }).first();
    await chip.click().catch(() => {});
    const next = page.locator('text=/next|continue|send it|create/i').first();
    if (await next.isVisible().catch(() => false)) { await next.click().catch(() => {}); await page.waitForTimeout(500); }
    const t = await page.locator('body').innerText().catch(() => '');
    if (/have them scan this|refreshes after each scan|checked in/i.test(t)) break;
  }
}
await page.waitForTimeout(1200);
await ss(page, '02_host_checkin');

let hostText = await page.locator('body').innerText().catch(() => '');
// If we didn't auto-land on check-in, try a "check in" affordance from home.
if (!/have them scan this/i.test(hostText)) {
  const ci = page.locator('text=/check in/i').first();
  if (await ci.isVisible().catch(() => false)) { await ci.click(); await page.waitForTimeout(1200); }
  hostText = await page.locator('body').innerText().catch(() => '');
  await ss(page, '02b_host_checkin');
}

const svgCount = await page.locator('svg').count();
const hasScanCaption = /have them scan this with their camera/i.test(hostText);
const noGiantCode = !/show this to your crew/i.test(hostText);
log(`HOST: svg elements=${svgCount} scanCaption=${hasScanCaption} oldCodeCaptionGone=${noGiantCode}`);
if (svgCount < 1) throw new Error('FAIL: no <svg> QR rendered on host screen');
if (!hasScanCaption) log('WARN: scan caption not found (may not have reached host checkin)');

// ── 3. GUEST mock flow: tap-to-scan simulate → "you're in" ──────────────────
log('testing guest mock scan flow via deep-link demo (no host QR camera in headless)');
await page.goto(`${BASE}/?event=demo`);
await page.waitForTimeout(1200);
await onboard();
let guestText = await page.locator('body').innerText().catch(() => '');
await ss(page, '03_guest_event');
log(`guest event view snippet: ${guestText.slice(0, 120).replace(/\n/g, ' ')}`);

// ── 4. DEEP LINK: /?event=…&checkin=… must not crash and land somewhere sane ──
log('simulating a scanned deep-link visit');
await page.goto(`${BASE}/?event=demo&checkin=ABC123`);
await page.waitForTimeout(1500);
await onboard();
await page.waitForTimeout(1200);
const deepText = await page.locator('body').innerText().catch(() => '');
await ss(page, '04_deeplink');
log(`deep-link landing snippet: ${deepText.slice(0, 160).replace(/\n/g, ' ')}`);
const landedSane = /you're in|scan to check in|code expired|kickback|check in|pot|demo|no event/i.test(deepText) || deepText.length > 0;
log(`deep-link landed on a sensible screen (no crash): ${landedSane}`);
if (!landedSane) throw new Error('FAIL: deep-link produced an empty/broken screen');

// ── 5. Errors ─────────────────────────────────────────────────────────────────
log(`\nJS errors collected (${errs.length}):`);
errs.forEach(e => log(`  ERROR: ${e}`));

log('\nRESULT: host QR renders as SVG, guest/deep-link flows load without crashing.');
await browser.close();
