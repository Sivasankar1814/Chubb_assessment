import { Market } from './enums';

export interface Currency {
  /** ISO 4217 code. */
  code: string;
  name: string;
  symbol: string;
  /** Digits after the point: 2 for dollars and cents, 0 for yen and rupiah, which have no minor unit. */
  decimals: 0 | 2;
}

/**
 * The currency of each market. A claim is filed and shown in the currency of its market, which is chosen when the
 * claim is filed (a claimant whose profile has a market can only file in it; the backend refuses any other). The
 * backend stores the bare amount and has no currency of its own, so this table is what says which currency a stored
 * amount is in.
 */
export const MARKET_CURRENCIES: Record<Market, Currency> = {
  SG: { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', decimals: 2 },
  HK: { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$', decimals: 2 },
  JP: { code: 'JPY', name: 'Japanese yen', symbol: '¥', decimals: 0 },
  TH: { code: 'THB', name: 'Thai baht', symbol: '฿', decimals: 2 },
  IN: { code: 'INR', name: 'Indian rupee', symbol: '₹', decimals: 2 },
  ID: { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp', decimals: 0 },
};

/** The currency for a market, or null when there is no market yet (or one this table does not know). */
export function currencyOf(market: Market | null | undefined): Currency | null {
  return (market && MARKET_CURRENCIES[market]) || null;
}
