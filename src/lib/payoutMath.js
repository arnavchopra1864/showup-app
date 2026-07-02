export const PLATFORM_FEE_RATE = 0.10;

export function calcPayout(stake, totalPaid, totalAttended) {
  const forfeited     = stake * (totalPaid - totalAttended);
  const fee           = forfeited * PLATFORM_FEE_RATE;
  const distributable = forfeited - fee;
  const payout        = totalAttended > 0 ? stake + distributable / totalAttended : stake;
  const profit        = payout - stake;
  return { payout: +payout.toFixed(2), profit: +profit.toFixed(2), fee: +fee.toFixed(2) };
}
