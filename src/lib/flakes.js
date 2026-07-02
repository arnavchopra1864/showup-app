export const USD_TO_FLAKES = 10;

export const WELCOME_BONUS = 100;

export const FLAKE_PACKS = [
  { usd: 5,  flakes: 5 * USD_TO_FLAKES },
  { usd: 10, flakes: 10 * USD_TO_FLAKES, popular: true },
  { usd: 20, flakes: 20 * USD_TO_FLAKES },
  { usd: 50, flakes: 50 * USD_TO_FLAKES },
];

export const usdToFlakes = (usd) => usd * USD_TO_FLAKES;
