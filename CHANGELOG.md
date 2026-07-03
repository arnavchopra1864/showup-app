# Changelog

All notable changes to ShowUp are documented here.

## [Unreleased]

### Added
- **Stripe money-in (built & deployed 2026-07-02/03).** Gold Flake packs are
  bought through Stripe Checkout via Supabase Edge Functions:
  `create-checkout` builds the session (packs validated server-side) and the
  signature-verified `stripe-webhook` (deployed `--no-verify-jwt`) idempotently
  inserts the `payments` row + `purchase` ledger entry — the client never
  credits itself. BuyScreen and the onboarding wallet step hand off to
  Checkout; `?checkout=success|cancel` redirects are captured in `App.jsx`
  and BuyScreen polls the balance until the webhook credit lands.
- **Stripe money-out backend (UI pending).** `connect-onboard` creates a
  Stripe Connect Express account (stored in `profiles.stripe_account_id`,
  migration 0006) and returns an onboarding link; `cash-out` debits the
  `cash` ledger bucket then sends a Stripe transfer (debit-before-transfer,
  compensating delete on failure). Client wrappers live in `src/lib/wallet.js`
  but are not yet wired into any screen.
- **Auto-close sweeper (migration 0007).** A pg_cron job runs every 15
  minutes and closes events still `upcoming` 12 hours after start: if
  check-in ran, the normal payout fires (stragglers flaked); if check-in
  never ran, the event is voided and all stakes refunded. EventCard shows a
  "close out" nudge to hosts 3+ hours after start.

### Changed
- **Direction: friends-only app with cash-in AND cash-out** (decided
  2026-07-02, reversing the earlier closed-loop plan). Flakes are backed by
  real money via Stripe; only the `cash` bucket is withdrawable — the free
  welcome flakes (`promo` bucket) are stake-only. BuyScreen shows a
  "coming later" placeholder where the cash-out UI will go.
- **FlakeShop** now passes the pack's USD price through to `onPurchase` and
  drops the "demo only, no real charge" footer.

### Fixed
- **cancel_event double refunds (migration 0008).** Cancelling refunded
  every `stake_hold` row, double-crediting participants who had already
  withdrawn early; it also had no status guard, so cancelling a closed
  event re-returned already-paid stakes. Now only still-staked participants
  are refunded and only `upcoming` events can be cancelled.

### Planned
- Cash-out UI: "set up payouts" (Connect onboarding) + cash-out form on
  BuyScreen, and handling for `?checkout=payouts-done|payouts-refresh`.
- End-to-end Stripe test-mode verification (card 4242…).
- Flake gifting between friends.
- In-app cosmetic sinks (streak flair, badges, event themes).
- Pack bonuses on larger flake packs to reduce effective processing fees.

## [0.1.0] - Pre-launch baseline
- Vite + React 19 app with Supabase backend (auth, events, staking,
  QR check-in, payouts, reliability stats via RPCs with RLS).
- Two-bucket append-only Gold Flakes ledger (`purchase`/promo buckets).
- Sign-out flow in ProfileScreen (2026-07-01).
