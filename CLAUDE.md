# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ShowUp is a mobile-first social accountability app: friends stake **Gold Flakes** (the app's virtual currency, ✨) to commit to events, and flakers forfeit their stake to those who showed up. Stakes are denominated in Gold Flakes, not real money — USD only appears as an on-ramp for buying Flakes (see Currency below).

This is a standalone **Vite + React 19 app**. Entry is `index.html` → `src/main.jsx` → `src/App.jsx` (the composition root). State is backed by **Supabase** when configured, with a mock fallback when it isn't.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built app
- `node checkin_test.mjs` — Playwright-based check-in flow test

## Config

Supabase credentials come from env vars (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`lib/supabase.js` exports `isSupabaseConfigured` (true when both are set). When unset, the app runs in mock mode: backend calls in `src/lib/*.js` degrade to no-ops/empty results.

## Architecture

```
src/
├── main.jsx                         # ReactDOM entry; mounts <App/>
├── App.jsx                          # Composition root: auth/onboarding gate, events state, router → screens
├── hooks/
│   └── useRouter.js                 # Stack-based nav: push/pop/replace/resetTo
├── lib/
│   ├── supabase.js                  # Supabase client + isSupabaseConfigured flag
│   ├── auth.js                      # Google OAuth, profiles table, grant_welcome_bonus RPC
│   ├── events.js                    # Event fetch/create/checkin/payout; normalizeEvent() row-shaping
│   ├── social.js                    # History + reliability stats fetches
│   ├── flakes.js                    # Gold Flakes constants (USD_TO_FLAKES, WELCOME_BONUS, FLAKE_PACKS)
│   ├── wallet.js                    # Stripe edge-function calls (checkout, cash-out, Connect onboarding) + fetchWallet
│   ├── currency.js                  # gf() formatter + currency naming
│   ├── payoutMath.js                # calcPayout + PLATFORM_FEE_RATE (10% on forfeited stakes)
│   └── reliabilityUtils.js          # safeRate / rateProps (showed% → label + color)
├── styles/
│   ├── globalStyles.js              # GLOBAL_STYLES CSS string injected via <style> in App
│   └── styleHelpers.js              # pill(color) → style object for status badges
├── components/                      # Shared, screen-agnostic UI
│   ├── Shell.jsx                    # Full-screen layout wrapper; accepts animClass prop
│   ├── Header.jsx                   # Gradient hero header with optional back button
│   ├── BottomNav.jsx                # Fixed tab bar (home / +new event / profile)
│   ├── FlakeShop.jsx                # Gold Flakes purchase UI (FLAKE_PACKS)
│   ├── EmptyCard.jsx                # Placeholder card for empty states
│   └── QRCodeSVG.jsx                # Custom SVG QR renderer (no external lib)
├── screens/
│   ├── OnboardingScreen/index.jsx   # Sign-in (Google OAuth) + profile creation (name/handle/avatar)
│   ├── HomeScreen/
│   │   ├── index.jsx                # Event feed: tonight / upcoming / past tabs
│   │   └── EventCard.jsx            # Card for a single event; receives nav as prop
│   ├── EventScreen.jsx              # RSVP flow: idle → confirming → paid
│   ├── CreateScreen/
│   │   ├── index.jsx                # 4-step wizard (vibe → details → stakes → send it)
│   │   ├── StepDots.jsx             # Progress indicator; receives step as prop
│   │   └── createScreenConstants.js # STAKE_OPTIONS, TIME_CHIPS, STEPS, CONF_OPTS
│   ├── CheckinScreen.jsx            # Host: rotating QR (120s expiry). Guest: tap-to-scan
│   ├── PayoutScreen.jsx             # Tap-through reveal: flakers → showups → payout → share
│   ├── BuyScreen.jsx                # Buy Gold Flakes (wraps FlakeShop)
│   ├── HowItWorksScreen.jsx         # Explainer screen
│   └── ProfileScreen.jsx            # Reliability %, streak/earnings stats, history, friends
└── ...
supabase/
├── migrations/                      # SQL schema — source of truth for the DB (tables, RLS, RPCs)
└── functions/                       # Deno edge functions (Stripe): create-checkout, stripe-webhook,
                                     #   connect-onboard, cash-out
```

## Key patterns

**Backend (Supabase).** All data access lives in `src/lib/*.js`. Every backend function checks `isSupabaseConfigured` and **gracefully degrades** to a mock/no-op result when Supabase is absent, so the UI runs without a backend. `normalizeEvent()` in `lib/events.js` reshapes raw Supabase rows (with joined `participants` / `profiles`) into the object shape `HomeScreen`/`EventCard` expect. Server-side logic (welcome bonus, check-in, payout, reliability) is implemented as **Postgres RPCs** invoked via `supabase.rpc(...)`.

**Schema lives in migrations.** The database schema, row-level security, and RPCs are defined in `supabase/migrations/*.sql` — that directory is the source of truth for the DB, not the JS.

**Auth & deep-link flow.** Sign-in is Google OAuth; a `profiles` row gates onboarding. When a user opens a share link (`?event=<id>`) before signing in, the id is stashed in `localStorage` (`showup_pendingEventId`) so it survives the OAuth redirect, then navigated to once onboarded (see `App.jsx`).

**Router** — `useRouter` returns `{ current, push, pop, replace, resetTo }`. The active screen and its data live in `nav.current = { screen, params }`. Screens receive `nav` as a prop and pass it down to child components that navigate (e.g. `EventCard` gets `nav` to push to checkin/payout).

**Inline styles everywhere.** No CSS modules or Tailwind. Shared CSS lives in `GLOBAL_STYLES` (animations, `.cta-btn`, `.field-input`, `.event-card`). The `pill(color)` helper in `styleHelpers.js` generates status badge styles.

**Currency (Gold Flakes).** The in-app currency is Gold Flakes (✨). Constants live in `lib/flakes.js` (`USD_TO_FLAKES`, `WELCOME_BONUS`, `FLAKE_PACKS`); formatting via `gf()` in `lib/currency.js`. USD prices Flake packs and cash-outs — stakes, pots, and payouts are all in Flakes. Only the `cash` ledger bucket is withdrawable; `promo` (welcome bonus) is stake-only. This is a **friends-only app**, not intended for public distribution.

**Payments (Stripe).** All money movement goes through the edge functions in `supabase/functions/` — the client never writes money rows. Money-in: `create-checkout` builds a Stripe Checkout Session (packs validated server-side); `stripe-webhook` (deployed with `--no-verify-jwt`) verifies the signature and idempotently inserts `payments` + `purchase` ledger rows. Money-out: `connect-onboard` creates a Stripe Connect Express account (stored in `profiles.stripe_account_id`) and returns an onboarding link; `cash-out` debits the ledger then sends a Stripe transfer. Stripe redirects back with `?checkout=success|cancel|payouts-done|payouts-refresh`, captured in `App.jsx` and routed to BuyScreen. Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` (via `supabase secrets set`).

**Payout math** — `calcPayout(stake, totalPaid, totalAttended)` in `lib/payoutMath.js`. The 10% fee is taken from forfeited stakes only; the remainder is split among attendees on top of getting their stake back.

**Color palette**: background `#0D0D0D`, primary purple `#7B2FFF`, accent pink `#FF2D78`, success green `#4ade80`, text `#F2F0FF`.
