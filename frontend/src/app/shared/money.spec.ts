import { MARKETS } from '../models/enums';
import { MARKET_CURRENCIES, currencyOf } from '../models/currency';
import { formatMoney } from './money';

const NBSP = String.fromCharCode(0xa0);

describe('formatMoney', () => {
  it('writes an amount in the currency of its market', () => {
    expect(formatMoney(1250.5, 'SG')).toBe('S$1,250.50');
    expect(formatMoney(4300, 'HK')).toBe('HK$4,300.00');
    expect(formatMoney(2500, 'TH')).toBe('฿2,500.00');
    expect(formatMoney(1100, 'IN')).toBe('₹1,100.00');
  });

  it('shows no decimals for a currency that has none', () => {
    expect(formatMoney(125000, 'JP')).toBe('¥125,000');
    expect(formatMoney(2500000, 'ID')).toBe(`Rp${NBSP}2,500,000`);
  });

  it('still shows a fraction that is really there, rather than hiding part of the amount', () => {
    expect(formatMoney(1950.5, 'JP')).toBe('¥1,950.5');
  });

  it('can name the currency', () => {
    expect(formatMoney(125000, 'JP', { code: true })).toBe('¥125,000 (JPY)');
    expect(formatMoney(1250.5, 'SG', { code: true })).toBe('S$1,250.50 (SGD)');
  });

  it('takes the amount as a number or as text', () => {
    expect(formatMoney('1250.50', 'SG')).toBe('S$1,250.50');
  });

  it('falls back to a plain number with no market, and to nothing with no amount', () => {
    expect(formatMoney(1250.5, null)).toBe('1,250.50');
    expect(formatMoney(null, 'SG')).toBe('');
    expect(formatMoney('', 'SG')).toBe('');
    expect(formatMoney('abc', 'SG')).toBe('');
  });
});

describe('MARKET_CURRENCIES', () => {
  it('covers every market, each with its own code', () => {
    const codes = MARKETS.map((market) => currencyOf(market)?.code);

    expect(codes).not.toContain(undefined);
    expect(new Set(codes).size).toBe(MARKETS.length);
    expect(Object.keys(MARKET_CURRENCIES).sort()).toEqual([...MARKETS].sort());
  });

  it('has no currency for no market', () => {
    expect(currencyOf(null)).toBeNull();
    expect(currencyOf(undefined)).toBeNull();
  });
});
