# Changelog

All notable changes to ShowUp are documented here.

## [Unreleased]

### Added
- **In-app camera QR scanner for guests.** The guest check-in screen now leads
  with a prominent "open camera 📷" button (where the host's QR sits) that opens
  a live in-browser scanner instead of forcing guests out to their phone's
  camera app. Decoding uses the native `BarcodeDetector` API where available
  (Android Chrome) and lazily falls back to `jsqr` (new dependency) scanning
  video frames via canvas elsewhere (iOS Safari has no `BarcodeDetector`). The
  scanner and jsqr are code-split behind a dynamic `import()` so they only load
  when the button is tapped (separate ~48 kB-gzip jsqr chunk, kept off the main
  bundle). On a decode it parses the deep-link and runs the exact same check-in
  path as an OAuth deep-link (honouring the scanned event even if it differs
  from the current screen); non-ShowUp codes show a brief "that's not a showup
  code" and keep scanning. Camera tracks are always stopped on close/unmount,
  and permission-denied / no-camera states show friendly copy pointing back to
  the phone camera app. Mock mode keeps the existing tap-to-simulate demo.
  New `src/components/QrScanner.jsx`; shared `runCheckin`/`routeCheckin` helpers
  in `lib/events.js` so App.jsx and the scanner drive identical behaviour.
- **Stripe money-in (built & deployed 2026-07-02/03).** Gold Flake packs are
  bought through Stripe Checkout via Supabase Edge Functions:
  `create-checkout` builds the session (packs validated server-side) and the
  signature-verified `stripe-webhook` (deployed `--no-verify-jwt`) idempotently
  inserts the `payments` row + `purchase` ledger entry — the client never
  credits itself. BuyScreen and the onboarding wallet step hand off to
  Checkout; `?checkout=success|cancel` redirects are captured in `App.jsx`
  and BuyScreen polls the balance until the webhook credit lands.
- **Stripe money-out backend (deployed, unwired).** `connect-onboard` creates
  a Stripe Connect Express account (stored in `profiles.stripe_account_id`,
  migration 0006) and returns an onboarding link; `cash-out` debits the
  `cash` ledger bucket then sends a Stripe transfer (debit-before-transfer,
  compensating delete on failure). Client wrappers live in `src/lib/wallet.js`;
  cash-out is deferred to a future release, so nothing in the UI calls them yet.
- **Auto-close sweeper (migration 0007).** A pg_cron job runs every 15
  minutes and closes events still `upcoming` 12 hours after start: if
  check-in ran, the normal payout fires (stragglers flaked); if check-in
  never ran, the event is voided and all stakes refunded. EventCard shows a
  "close out" nudge to hosts 3+ hours after start.
- **PWA support.** `vite-plugin-pwa` generates an auto-updating service
  worker and `manifest.webmanifest` (name "ShowUp", standalone display,
  `#0D0D0D` theme) so the app can be installed to a home screen. New icon set
  in `public/icons/` (192/512/maskable) plus `public/apple-touch-icon.png`
  and `public/favicon.png` — a new purple-to-pink sparkle mark. The service
  worker only precaches the built app shell/assets; there's no runtime
  caching, so Supabase and Stripe calls always hit the network live. The SPA
  `navigateFallback` preserves deep links like `?event=` and `?checkout=`.
  `index.html` gained favicon/apple-touch-icon links and iOS standalone
  web-app meta tags.
- **Mobile UX polish.** Safe-area padding (`env(safe-area-inset-*)`) on
  Header, BottomNav, and the inline hero headers on EventScreen,
  PayoutScreen, CheckinScreen, and ProfileScreen so content clears notches
  and home indicators. Inputs are 16px (up from 14px on `.field-input`, plus
  a blanket 16px rule) to stop iOS Safari's auto-zoom on focus. Back buttons,
  tabs, and small links got larger tap targets. Globally:
  `-webkit-tap-highlight-color: transparent`, `overscroll-behavior-y: none`,
  `touch-action: manipulation`, and `user-select: none` on the body (with
  text selection re-enabled on inputs and the check-in code) for an
  app-like feel.

### Changed
- **Check-in is now a real scannable QR (replaces the 6-digit code).** The
  host screen renders an actual QR (via `qrcode.react`) encoding a deep-link
  `?event=<id>&checkin=<token>`; it re-renders as the token rotates (~100s)
  and after each scan. The guest side dropped the manual code-entry input —
  guests just point their camera at the host's screen. `App.jsx` reads the
  scanned `?checkin=<token>` (stashed in `localStorage` as
  `showup_pendingCheckin`, surviving the OAuth redirect like `?event`), runs
  `checkin_with_token` once onboarded, and lands on a clear result: "you're
  in ✓" on success or a friendly "code expired" card with a path back to the
  event on failure. Already-signed-in friends check in immediately without
  bouncing through onboarding. Mock mode keeps a tap-to-simulate demo path.
- **Direction: friends-only app with cash-in AND cash-out** (decided
  2026-07-02, reversing the earlier closed-loop plan). Flakes are backed by
  real money via Stripe; only the `cash` bucket is withdrawable — the free
  welcome flakes (`promo` bucket) are stake-only. Cash-out is now deferred to
  a future release: the placeholder "coming later" section was removed from
  BuyScreen, and the delete-account copy no longer references cashing out.
  Money-out stays backend-only for now (see Stripe money-out above).
- **FlakeShop** now passes the pack's USD price through to `onPurchase` and
  drops the "demo only, no real charge" footer.

### Fixed
- **Check-in failures are now differentiated (real-device bug).** A guest who
  hadn't RSVP'd would scan the QR and get "code expired", which was wrong and
  confusing. The `checkin_with_token` errors are now bucketed defensively (by
  substring, since PostgREST wraps the message): "you're not in this event"
  routes the guest to the EventScreen with a pink nudge ("you're not in this
  one yet — rsvp first, then scan again") so they can stake and re-scan;
  genuinely invalid/expired tokens ("code expired", "no active check-in
  session", "wrong code") keep the "code expired" card; and anything else
  ("check-in is closed", bad status, network) shows a generic "couldn't check
  you in" card — all with a "back to the event" escape hatch, never a dead end.
- **Mock-mode onboarding was a dead end.** Without Supabase, tapping "continue
  with google" never advanced past the sign-in step (no OAuth callback to
  listen for), so the app couldn't be used or demoed backend-free. It now
  advances straight to profile setup in mock mode (no effect on the real
  Supabase path).
- **cancel_event double refunds (migration 0008).** Cancelling refunded
  every `stake_hold` row, double-crediting participants who had already
  withdrawn early; it also had no status guard, so cancelling a closed
  event re-returned already-paid stakes. Now only still-staked participants
  are refunded and only `upcoming` events can be cancelled.

### Planned
- Cash-out UI (v2): "set up payouts" (Connect onboarding) + cash-out form,
  and handling for `?checkout=payouts-done|payouts-refresh`.
- End-to-end Stripe test-mode verification (card 4242…).
- Flake gifting between friends.
- In-app cosmetic sinks (streak flair, badges, event themes).
- Pack bonuses on larger flake packs to reduce effective processing fees.

## [0.1.0] - Pre-launch baseline
- Vite + React 19 app with Supabase backend (auth, events, staking,
  QR check-in, payouts, reliability stats via RPCs with RLS).
- Two-bucket append-only Gold Flakes ledger (`purchase`/promo buckets).
- Sign-out flow in ProfileScreen (2026-07-01).
