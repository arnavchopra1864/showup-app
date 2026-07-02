export const GOLD_FLAKE = "✨";
export const CURRENCY_NAME = "Gold Flakes";

export function gf(amount, { decimals = 0, long = false } = {}) {
  const value = (Number(amount) || 0).toFixed(decimals);
  return `${value} ${long ? CURRENCY_NAME : GOLD_FLAKE}`;
}
