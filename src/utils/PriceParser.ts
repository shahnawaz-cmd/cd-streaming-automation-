import { expect } from '@playwright/test';

export interface ParsedPrice {
  amount: number;
  currencyToken: string;
  raw: string;
}

/**
 * Currency-agnostic price parser for multi-currency Preview, Plans, Upsell & Checkout UIs.
 * Supports symbols ($ € £ ¥ ₹ ₩ ₪ ₫ ₺ ₽), multi-char prefixes/codes (CA$, US$, A$, R$, Rs, kr, CHF, USD, EUR, PKR),
 * dot/comma decimals ("29.99", "29,99"), and thousands separators ("1,234.56", "1.234,56").
 */
export class PriceParser {
  private static readonly PERCENT_RE = /\d+(?:[.,]\d+)?\s*%/g;
  private static readonly SYMBOLS = '$€£¥₹₩₪₫₺₽₱฿₦₴';
  private static readonly ISO_CODES =
    'CHF|EUR|USD|GBP|CAD|AUD|SEK|NOK|DKK|PKR|INR|AED|SAR|NZD|SGD|HKD|JPY|CNY|KRW|TWD|THB|MYR|IDR|PHP|VND|BRL|MXN|ARS|CLP|COP|PEN|ZAR|EGP|NGN|KES|PLN|CZK|HUF|RON|BGN|TRY|ILS|RUB|UAH|QAR|KWD|BHD|OMR|BDT|LKR|NPR';
  private static readonly PRICE_TOKEN_RE = new RegExp(
    `(?:([A-Za-z]{1,3}[$€£¥₹]|[${PriceParser.SYMBOLS}]|(?:zł|Zł|Kč)(?=\\s|\\d)|\\b(?:[Rr]s\\.?|RM|Rp)(?=\\s|\\d)|\\b(?:[Kk]r|${PriceParser.ISO_CODES})\\b)\\s*)?(\\d+(?:[.,]\\d+)*)(?:\\s*([${PriceParser.SYMBOLS}]|(?:zł|Zł|Kč)(?!\\w)|\\b(?:[Rr]s\\.?|RM|Rp|[Kk]r|${PriceParser.ISO_CODES})\\b))?`,
    'g'
  );

  /**
   * Normalizes a formatted numeric string into a JS float regardless of locale separators.
   */
  static normalizeNumber(numStr: string): number {
    const clean = numStr.trim().replace(/\s+/g, '');
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
      if (lastDot > lastComma) {
        return Number(clean.replace(/,/g, ''));
      }
      return Number(clean.replace(/\./g, '').replace(',', '.'));
    }

    if (lastComma !== -1) {
      const decimals = clean.length - lastComma - 1;
      if (decimals === 1 || decimals === 2) {
        return Number(clean.replace(',', '.'));
      }
      return Number(clean.replace(/,/g, ''));
    }

    if (lastDot !== -1) {
      const decimals = clean.length - lastDot - 1;
      const dotCount = (clean.match(/\./g) || []).length;
      if (dotCount > 1 || decimals === 3) {
        return Number(clean.replace(/\./g, ''));
      }
      return Number(clean);
    }

    return Number(clean);
  }

  private static extractAll(rawText: string): ParsedPrice[] {
    const cleaned = rawText
      .replace(/(?<=\d)[\u00A0\u202F](?=\d{3}(?:\D|$))/g, '')
      .replace(PriceParser.PERCENT_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const results: ParsedPrice[] = [];
    const regex = new RegExp(PriceParser.PRICE_TOKEN_RE.source, PriceParser.PRICE_TOKEN_RE.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      const prefixCurrency = (match[1] || '').replace(/\s+/g, '').trim();
      const numRaw = match[2];
      const suffixCurrency = (match[3] || '').trim();
      const amount = PriceParser.normalizeNumber(numRaw);
      if (Number.isNaN(amount)) continue;

      results.push({
        amount,
        currencyToken: prefixCurrency || suffixCurrency,
        raw: match[0].trim(),
      });
    }

    return results;
  }

  /**
   * Extracts the first price from a clean price label (e.g., "$10", "€29,99", "Total: 119.99 kr").
   */
  static parsePrice(rawText: string): ParsedPrice {
    const matches = PriceParser.extractAll(rawText);
    if (matches.length === 0) {
      throw new Error(`[PriceParser] Could not parse price from text: "${rawText}"`);
    }
    return matches[0];
  }

  /**
   * Every numeric amount in a text, regardless of currency symbol/code ("₩44,745" -> 44745, "€27,29" -> 27.29).
   * Use when the currency token may be one the parser does not know (CRC, PAB, ...).
   */
  static numbersIn(rawText: string): number[] {
    return (rawText.match(/\d[\d.,  ]*/g) ?? [])
      .map((token) => PriceParser.normalizeNumber(token.replace(/[.,  ]+$/, '')))
      .filter((n) => !Number.isNaN(n));
  }

  /**
   * Extracts the final price from a CTA or total line (e.g., "Access Vehicle History • $54.99", "Pay €39.99").
   */
  static parseLastPrice(rawText: string): ParsedPrice {
    const segments = rawText.split('•');
    const tail = segments[segments.length - 1] || rawText;
    const matches = PriceParser.extractAll(tail);
    if (matches.length > 0) {
      return matches[matches.length - 1];
    }
    const fallbackMatches = PriceParser.extractAll(rawText);
    if (fallbackMatches.length > 0) {
      return fallbackMatches[fallbackMatches.length - 1];
    }
    throw new Error(`[PriceParser] Could not parse trailing price from text: "${rawText}"`);
  }

  /**
   * Extracts a standalone or currency-tagged price from a short UI line,
   * rejecting item counts like "2 Reports" or "10 reports" unless tagged with a currency token.
   */
  static tryParseCurrencyLine(line: string): ParsedPrice | null {
    const trimmed = line.replace(/\s+/g, ' ').trim();
    if (!trimmed || /\bVIN\b/i.test(trimmed)) return null;

    const matches = PriceParser.extractAll(trimmed);
    const tagged = matches.filter((m) => m.currencyToken.length > 0);
    if (tagged.length > 0) {
      return tagged[tagged.length - 1];
    }

    if (/^[\d.,\s]+$/.test(trimmed) && matches.length === 1) {
      return matches[0];
    }
    return null;
  }

  /**
   * Asserts two currency amounts match within floating-point rounding tolerance.
   */
  static assertAmountClose(
    actual: number,
    expected: number,
    label: string,
    tolerance = 0.02
  ): void {
    expect(
      Math.abs(actual - expected),
      `${label}: expected ${expected.toFixed(2)}, received ${actual.toFixed(2)}`
    ).toBeLessThanOrEqual(tolerance);
  }

  /**
   * Scale-aware assertion tolerance for converted currencies and rounding deltas.
   */
  static dynamicTolerance(
    expectedAmount: number,
    relativeRatio = 0.01,
    minFloor = 0.05
  ): number {
    return Math.max(minFloor, Math.abs(expectedAmount) * relativeRatio);
  }
}
