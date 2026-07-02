import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5199';
const SCRATCHPAD = '/private/tmp/claude-501/-Users-arnav-my-projects-showup-app/0202c9ac-df4c-4def-ad77-c5513afc4315/scratchpad';

const ss = async (page, name) => {
  await page.screenshot({ path: `${SCRATCHPAD}/${name}.png` });
  console.log(`[screenshot] ${name}.png`);
};

const log = (msg) => console.log(`[step] ${msg}`);
const errs = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

// Capture console errors
ctx.on('page', p => {
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
});

const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(e.message));

// ── 1. Load app ──────────────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForTimeout(2000);
await ss(page, '01_initial');
log('app loaded');

// ── 2. Check what screen we're on ────────────────────────────────────────────
const bodyText = await page.locator('body').innerText().catch(() => '');
log(`body text snippet: ${bodyText.slice(0, 200)}`);

// Check if onboarding or home
const isOnboarding = bodyText.toLowerCase().includes('sign in') || 
                     bodyText.toLowerCase().includes('google') ||
                     bodyText.toLowerCase().includes('onboard');
const isHome = bodyText.toLowerCase().includes('tonight') || 
               bodyText.toLowerCase().includes('upcoming') ||
               bodyText.toLowerCase().includes('no events');
log(`isOnboarding=${isOnboarding} isHome=${isHome}`);
await ss(page, '02_screen_state');

// ── 3. If already logged in, look for checkin events ─────────────────────────
if (isHome) {
  log('already logged in, checking for events');
  
  // Look for any "check in" button or event
  const checkinBtn = page.locator('text=check in').first();
  const hasCheckin = await checkinBtn.isVisible().catch(() => false);
  log(`has checkin event visible: ${hasCheckin}`);
  
  if (hasCheckin) {
    await checkinBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, '03_checkin_screen');
    log('navigated to checkin screen');
    
    const checkinText = await page.locator('body').innerText().catch(() => '');
    log(`checkin screen content: ${checkinText.slice(0, 300)}`);
    
    // Check for QR or generating state
    const hasQR = checkinText.includes('show this to your crew') || 
                  checkinText.includes('generating');
    const hasCloseBtn = checkinText.toLowerCase().includes('close check-in') ||
                        checkinText.toLowerCase().includes('pay out');
    log(`hasQR=${hasQR} hasCloseBtn=${hasCloseBtn}`);
    
    if (hasCloseBtn) {
      // Test close → payout
      const closeBtn = page.locator('text=/close check-in/i').first();
      const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
      log(`close button visible: ${closeBtnVisible}`);
      
      if (closeBtnVisible) {
        await closeBtn.click();
        await page.waitForTimeout(3000);
        await ss(page, '04_after_close');
        const afterText = await page.locator('body').innerText().catch(() => '');
        log(`after close: ${afterText.slice(0, 200)}`);
        const onPayout = afterText.toLowerCase().includes('results') || 
                         afterText.toLowerCase().includes('payout') ||
                         afterText.toLowerCase().includes('flaked') ||
                         afterText.toLowerCase().includes('tallying');
        log(`reached payout screen: ${onPayout}`);
      }
    }
  } else {
    // No checkin event — look for any event to inspect state
    const anyEvent = page.locator('.event-card, [class*="event"]').first();
    const hasEvents = await anyEvent.isVisible().catch(() => false);
    log(`any events visible: ${hasEvents}`);
    
    if (!hasEvents) {
      log('no events on home screen — checking all tabs');
      // Try upcoming tab
      const upcomingTab = page.locator('text=upcoming').first();
      if (await upcomingTab.isVisible().catch(() => false)) {
        await upcomingTab.click();
        await page.waitForTimeout(500);
      }
      await ss(page, '03_home_no_events');
    }
  }
} else if (isOnboarding) {
  log('on onboarding screen — cannot test checkin without auth');
  await ss(page, '03_onboarding');
}

// ── 4. Test guest code entry (if we can reach it) ────────────────────────────
// Navigate to a fresh page and simulate guest checkin screen
await page.goto(BASE);
await page.waitForTimeout(1500);
const freshText = await page.locator('body').innerText().catch(() => '');
log(`fresh load state: ${freshText.slice(0, 100)}`);

// ── 5. Errors collected ───────────────────────────────────────────────────────
log(`\nJS errors collected (${errs.length}):`);
errs.forEach(e => log(`  ERROR: ${e}`));

await browser.close();
