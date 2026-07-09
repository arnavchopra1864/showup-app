import { chromium } from 'playwright';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:5199';
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const HARNESS = `${ROOT}dev_checkin_harness.html`;
const SCRATCHPAD = '/private/tmp/claude-501/-Users-arnav-my-projects-showup-app/570c2950-ca4e-4cbf-a67d-2647aa9d333a/scratchpad';

const ss = async (page, name) => {
  await page.screenshot({ path: `${SCRATCHPAD}/${name}.png` });
  console.log(`[screenshot] ${name}.png`);
};
const log = (msg) => console.log(`[step] ${msg}`);
const errs = [];

const browser = await chromium.launch({
  headless: true,
  // Fake a camera so the lazy scanner can start in CI (real decode still needs a phone).
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
// iPhone-ish emulation
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
await ctx.grantPermissions(['camera']).catch(() => {});
ctx.on('page', p => {
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
});

const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(e.message));

// Complete the mock-mode onboarding (AUTH → profile → how → wallet → welcome)
// so we reach the home feed. Step-aware so it doesn't stop early.
async function onboard() {
  const click = (re) => page.locator(`text=${re}`).first().click().catch(() => {});
  for (let i = 0; i < 12; i++) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (/continue with google/i.test(body)) {
      await click('/continue with google/i');
    } else if (/who are you/i.test(body)) {
      const inputs = page.locator('input:visible');
      const n = await inputs.count().catch(() => 0);
      for (let j = 0; j < n; j++) {
        const inp = inputs.nth(j);
        if (!(await inp.inputValue().catch(() => 'x'))) await inp.fill(j === 1 ? 'ada' + Date.now() : 'ada').catch(() => {});
      }
      await click('/create account/i');
    } else if (/how it|makes sense/i.test(body)) {
      await click('/makes sense/i');
    } else if (/load up your wallet/i.test(body)) {
      await click('/give me the free flakes/i');
    } else if (/welcome gift|enter showup/i.test(body)) {
      await click('/enter showup/i');
    } else {
      break; // reached the app shell
    }
    await page.waitForTimeout(600);
  }
}

// ── 1. Load + onboard ─────────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForTimeout(1500);
await onboard();
await ss(page, '01_home');
const home = await page.locator('body').innerText().catch(() => '');
log(`home snippet: ${home.slice(0, 120).replace(/\n/g, ' ')}`);

// ── 2 + 3. HOST QR and GUEST screens via a component mount harness ───────────
// The real host check-in (create-event wizard) and guest check-in screens are
// awkward/impossible to reach deterministically in headless mock mode (the
// guest outcome screens are session-gated in App.jsx). Instead we mount the
// actual shipped components with fabricated props — Vite transforms the inline
// module script, so these are real renders of the production components.
writeFileSync(HARNESS, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div>
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GLOBAL_STYLES } from '/src/styles/globalStyles.js';
import { CheckinScreen } from '/src/screens/CheckinScreen.jsx';
import { EventScreen } from '/src/screens/EventScreen.jsx';
const nav = { push(){}, pop(){}, replace(){}, resetTo(){}, current:{screen:'',params:{}} };
const view = new URLSearchParams(location.search).get('view');
const guest = { eventId:'E1', nav, refreshBalance(){}, refreshEvents(){}, event:{ name:'kickback', isHost:false } };
let el;
if (view === 'host') el = React.createElement(CheckinScreen, { eventId:'E1', nav, refreshBalance(){}, refreshEvents(){}, event:{ name:'kickback', isHost:true, potTotal:150 } });
else if (view === 'checkin-expired') el = React.createElement(CheckinScreen, { ...guest, checkinResult:'expired' });
else if (view === 'checkin-other') el = React.createElement(CheckinScreen, { ...guest, checkinResult:'other' });
else if (view === 'checkin-hint') el = React.createElement(CheckinScreen, guest);
else if (view === 'event-nudge') el = React.createElement(EventScreen, { eventId:'E1', nav, userId:'U1', event:{ name:'kickback', host_id:'HOST', stake:50 }, notice:"you're not in this one yet — rsvp first, then scan again" });
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null, React.createElement('style', null, GLOBAL_STYLES), el));
window.__mounted = true;
</script></body></html>`);

const mountView = async (view) => {
  await page.goto(`${BASE}/dev_checkin_harness.html?view=${view}`);
  await page.waitForFunction(() => window.__mounted === true, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  return page.locator('body').innerText().catch(() => '');
};

try {
  // 2. HOST: a real scannable QR <svg> renders (token from mock refreshCheckinToken).
  log('host check-in: expect a real QR <svg> + scan caption');
  const hostText = await mountView('host');
  await ss(page, '02_host_checkin');
  const svgCount = await page.locator('svg').count();
  const hasScanCaption = /have them scan this with their camera/i.test(hostText);
  log(`HOST: svg elements=${svgCount} scanCaption=${hasScanCaption}`);
  if (svgCount < 1) throw new Error('FAIL: no <svg> QR rendered on host screen');
  if (!hasScanCaption) throw new Error('FAIL: host scan caption missing');

  // 3a. Guest scan-hint → prominent "open camera" button present.
  log('guest check-in (scan hint): expect open-camera button');
  const hintText = await mountView('checkin-hint');
  await ss(page, '03_guest_hint');
  log(`GUEST hint: openCameraBtn=${/open camera/i.test(hintText)} scanToCheckIn=${/scan to check in/i.test(hintText)}`);
  if (!/open camera/i.test(hintText)) throw new Error('FAIL: open-camera button missing on guest scan-hint view');

  // 3b. Expired token → open-camera button AND the "code expired" card.
  log('guest check-in (expired): expect open-camera + code-expired card');
  const expiredText = await mountView('checkin-expired');
  await ss(page, '04_guest_expired');
  log(`GUEST expired: openCameraBtn=${/open camera/i.test(expiredText)} expiredCard=${/code expired/i.test(expiredText)}`);
  if (!/open camera/i.test(expiredText)) throw new Error('FAIL: open-camera button missing on expired view');
  if (!/code expired/i.test(expiredText)) throw new Error('FAIL: expired card missing');

  // 3c. Unknown/other error → generic friendly failure, NOT "code expired".
  log('guest check-in (other error): expect generic failure, not the expired card');
  const otherText = await mountView('checkin-other');
  await ss(page, '05_guest_other');
  log(`GUEST other: genericCard=${/couldn't check you in/i.test(otherText)} notExpired=${!/code expired/i.test(otherText)}`);
  if (!/couldn't check you in/i.test(otherText)) throw new Error('FAIL: generic failure card missing');
  if (/code expired/i.test(otherText)) throw new Error('FAIL: unknown error wrongly shown as expired');

  // 3d. Tapping "open camera" mounts the lazy scanner (camera faked in CI; a
  //     real decode needs a phone, but the chunk must load + render cleanly).
  log('guest: tapping open-camera mounts the lazy scanner');
  const camBtn = page.locator('text=/open camera/i').first();
  await camBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  const scanText = await page.locator('body').innerText().catch(() => '');
  await ss(page, '06_guest_scanner');
  const scannerUp = /point at the host|starting camera|cancel|camera access|no camera|couldn't start/i.test(scanText);
  log(`GUEST scanner mounted: ${scannerUp}`);
  if (!scannerUp) throw new Error('FAIL: scanner UI did not mount after tapping open-camera');

  // 3e. Non-participant routing → EventScreen renders the rsvp nudge banner.
  log('event screen with not-participant nudge banner');
  const nudgeText = await mountView('event-nudge');
  await ss(page, '07_event_nudge');
  log(`EVENT nudge: shown=${/not in this one yet/i.test(nudgeText)} notExpired=${!/code expired/i.test(nudgeText)}`);
  if (!/not in this one yet/i.test(nudgeText)) throw new Error('FAIL: EventScreen rsvp nudge banner missing');
} finally {
  try { unlinkSync(HARNESS); } catch {}
}

// ── 4. Task-1 routing logic (env-agnostic; the crux of failure differentiation) ──
// Exercise classifyCheckinError + routeCheckin against the exact RPC messages
// from supabase/migrations/0004_checkin_payout.sql, in-browser via the served
// module so the real shipped code runs.
log('verifying classifyCheckinError + routeCheckin against the RPC error strings');
await page.goto(BASE);
await page.waitForTimeout(500);
const logic = await page.evaluate(async () => {
  const m = await import('/src/lib/events.js');
  const cls = m.classifyCheckinError;
  const route = (status, opts) => { const r = []; const nav = { push:(s,p)=>r.push({how:'push',s,p}), replace:(s,p)=>r.push({how:'replace',s,p}) }; m.routeCheckin(nav, 'E1', { status }, opts); return r[0]; };
  return {
    notIn:      cls("you're not in this event"),
    notInWrap:  cls("supabase error (P0001): you're not in this event"),
    expired:    cls('code expired — ask the host to refresh'),
    noSession:  cls('no active check-in session'),
    wrongCode:  cls('wrong code'),
    closed:     cls('check-in is closed'),
    badStatus:  cls('cannot check in — status: flaked'),
    network:    cls('network error'),
    rNotIn:     route('not-participant'),
    rSuccess:   route('success'),
    rExpired:   route('expired'),
    rOther:     route('other'),
    rReplace:   route('expired', { replace: true }),
  };
});
const expect = (name, got, want) => { log(`  ${name}: ${got} (want ${want})`); if (got !== want) throw new Error(`FAIL: ${name} = ${got}, expected ${want}`); };
expect('classify not-in',        logic.notIn,     'not-participant');
expect('classify not-in wrapped',logic.notInWrap, 'not-participant');
expect('classify expired',       logic.expired,   'expired');
expect('classify no-session',    logic.noSession, 'expired');
expect('classify wrong-code',    logic.wrongCode, 'expired');
expect('classify closed',        logic.closed,    'other');
expect('classify bad-status',    logic.badStatus, 'other');
expect('classify network',       logic.network,   'other');
if (logic.rNotIn.s !== 'event' || !/not in this one yet/.test(logic.rNotIn.p.notice)) throw new Error('FAIL: not-participant not routed to event with nudge');
if (logic.rSuccess.s !== 'checkin' || logic.rSuccess.p.checkinResult !== 'success')  throw new Error('FAIL: success route wrong');
if (logic.rExpired.p.checkinResult !== 'expired') throw new Error('FAIL: expired route wrong');
if (logic.rOther.p.checkinResult !== 'other')     throw new Error('FAIL: other route wrong');
if (logic.rReplace.how !== 'replace')             throw new Error('FAIL: replace option ignored');
log('Task-1 routing logic: all cases correct');

// ── 5. Errors ─────────────────────────────────────────────────────────────────
log(`\nJS errors collected (${errs.length}):`);
errs.forEach(e => log(`  ERROR: ${e}`));
if (errs.length) throw new Error(`FAIL: ${errs.length} JS error(s) collected`);

log('\nRESULT: host QR renders; guest gets an open-camera button + lazy scanner; check-in failures differentiate (expired vs generic vs rsvp-nudge); routing logic verified against RPC strings; no JS errors.');
await browser.close();
