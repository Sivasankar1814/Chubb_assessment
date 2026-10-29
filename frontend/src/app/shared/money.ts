import { currencyOf } from '../models/currency';
import { Market } from '../models/enums';

/** Keeps a letter symbol ("Rp") on the same line as the figure. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

const formatters = new Map<number, Intl.NumberFormat>();

function digits(decimals: number): Intl.NumberFormat {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    // Always the currency's own digits; a stored amount with more (a yen amount of 1950.5) still shows in full.
    formatter = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: Math.max(decimals, 2),
    });
    formatters.set(decimals, formatter);
  }
  return formatter;
}

/**
 * An amount in the currency of its market: "S$1,250.50", "¥125,000", "Rp 2,500,000". With `code`, the ISO code
 * follows in brackets. Without a market the amount is shown as a plain number, as before.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  market: Market | null | undefined,
  options: { code?: boolean } = {},
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '';
  }
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '';
  }
  const currency = currencyOf(market);
  const number = digits(currency?.decimals ?? 2).format(value);
  if (!currency) {
    return number;
  }
  // A letter symbol ("Rp") needs a space before the figure; a sign ("¥", "S$") does not.
  const symbol = /[A-Za-z]$/.test(currency.symbol)
    ? `${currency.symbol}${NO_BREAK_SPACE}`
    : currency.symbol;
  return `${symbol}${number}${options.code ? ` (${currency.code})` : ''}`;
}
