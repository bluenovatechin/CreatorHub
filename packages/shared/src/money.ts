/**
 * MONEY: rupees ↔ paise (always store whole paise), Indian ₹ formatting, suggested brand price from payout + margin.
 */
/** All money is stored as integer paise. Never use floats for money. */

export const rupeesToPaise = (rupees: number): number => {
  if (!Number.isInteger(rupees)) throw new Error('Rupee amounts must be whole numbers');
  return rupees * 100;
};

export const paiseToRupees = (paise: number): number => Math.floor(paise / 100);

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatINR = (paise: number): string => inr.format(Math.round(paise / 100));

/**
 * Suggested brand price for a creator payout at a margin (basis points),
 * rounded up to the nearest ₹100.
 */
export function suggestBrandPrice(payoutPaise: number, marginBps: number): number {
  if (marginBps < 0 || marginBps >= 10000) throw new Error('Invalid margin');
  const raw = Math.ceil((payoutPaise * 10000) / (10000 - marginBps));
  return Math.ceil(raw / 10000) * 10000;
}
