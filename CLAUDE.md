# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ShowUp is a mobile-first social accountability app: friends stake money to commit to events, and flakers forfeit their stake to those who showed up. The entry point is `src/App.jsx`, which is a React component intended to be used inside an external React project (Vite, CRA, etc.) that provides React as a dependency — there is no `package.json` in this repo.

## Architecture

```
src/
├── App.jsx                          # Composition root: holds events state, wires router to screens
├── data/
│   └── mockData.js                  # All seed constants (INITIAL_EVENTS, USER, FRIENDS, HISTORY)
├── hooks/
│   └── useRouter.js                 # Stack-based nav: push/pop/replace/resetTo
├── lib/
│   ├── payoutMath.js                # calcPayout + PLATFORM_FEE_RATE (10% on forfeited stakes)
│   └── reliabilityUtils.js          # safeRate / rateProps (showed% → label + color)
├── styles/
│   ├── globalStyles.js              # GLOBAL_STYLES CSS string injected via <style> in App
│   └── styleHelpers.js              # pill(color) → style object for status badges
├── components/                      # Shared, screen-agnostic UI
│   ├── Shell.jsx                    # Full-screen layout wrapper; accepts animClass prop
│   ├── Header.jsx                   # Gradient hero header with optional back button
│   ├── BottomNav.jsx                # Fixed tab bar (home / +new event / profile)
│   ├── EmptyCard.jsx                # Placeholder card for empty states
│   └── QRCodeSVG.jsx                # Custom SVG QR renderer (no external lib)
└── screens/
    ├── HomeScreen/
    │   ├── index.jsx                # Event feed: tonight / upcoming / past tabs
    │   └── EventCard.jsx            # Card for a single event; receives nav as prop
    ├── EventScreen.jsx              # RSVP flow: idle → confirming → paid
    ├── CreateScreen/
    │   ├── index.jsx                # 4-step wizard (vibe → details → stakes → send it)
    │   ├── StepDots.jsx             # Progress indicator; receives step as prop
    │   └── createScreenConstants.js # STAKE_OPTIONS, TIME_CHIPS, STEPS, CONF_OPTS
    ├── CheckinScreen.jsx            # Host: rotating QR (120s expiry). Guest: tap-to-scan
    ├── PayoutScreen.jsx             # Tap-through reveal: flakers → showups → payout → share
    └── ProfileScreen.jsx            # Reliability %, streak/earnings stats, history, friends
```

## Key patterns

**Router** — `useRouter` returns `{ current, push, pop, replace, resetTo }`. The active screen and its data live in `nav.current = { screen, params }`. Screens receive `nav` as a prop and pass it down to child components that navigate (e.g. `EventCard` gets `nav` to push to checkin/payout).

**Inline styles everywhere.** No CSS modules or Tailwind. Shared CSS lives in `GLOBAL_STYLES` (animations, `.cta-btn`, `.field-input`, `.event-card`). The `pill(color)` helper in `styleHelpers.js` generates status badge styles.

**Payout math** — `calcPayout(stake, totalPaid, totalAttended)` in `lib/payoutMath.js`. The 10% fee is taken from forfeited stakes only; the remainder is split among attendees on top of getting their stake back.

**Mock data** — All state is seeded from `src/data/mockData.js`. No backend or persistence. Replacing this file with API calls is the only change needed to wire up a real backend.

**Color palette**: background `#0D0D0D`, primary purple `#7B2FFF`, accent pink `#FF2D78`, success green `#4ade80`, text `#F2F0FF`.
