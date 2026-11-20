import { BrowserContext, expect } from '@playwright/test';
import { ENV } from '../config/env';
import { RegionalConfig } from '../data/RegionalPool';
import { PlanApiItem } from './PlansApi';
import { PriceParser } from './PriceParser';

/** Simulates a visitor from `region` by setting the geo cookies the backend prices from. */
export async function injectGeoCookies(context: BrowserContext, region: RegionalConfig): Promise<void> {
  await context.clearCookies({ name: 'cwa_ip' });
  await context.clearCookies({ name: 'cwa_country' });
  await context.addCookies([
    { name: 'cwa_ip', value: region.ip, url: ENV.baseURL, httpOnly: true, sameSite: 'Lax' },
    { name: 'cwa_country', value: region.country, url: ENV.baseURL, sameSite: 'Lax' },
  ]);
}

/**
 * The currency sign a browser shows for an ISO code ("EUR" -> "€", "KRW" -> "₩", "TWD" -> "NT$", "CRC" -> "CRC").
 * Derived from Intl, so no symbol table has to be maintained for new regions.
 */
export function expectedCurrencySign(currencyCode: string): string {
  const part = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? currencyCode;
}

/** A regional plan must be priced in the region's currency at `usd_price x conversion_rate`. */
export function assertLocalizedPlan(plan: PlanApiItem, region: RegionalConfig): void {
  expect(plan.currencyCode, `${region.name}: ${plan.nos}-pack currency`).toBe(region.currency);
  expect(plan.conversionRate, `${region.name}: conversion rate present for ${region.currency}`).toBeDefined();
  const expected = plan.usdPrice * plan.conversionRate!;
  PriceParser.assertAmountClose(
    plan.price,
    expected,
    `${region.currency} ${plan.nos}-pack = usd_price x rate`,
    PriceParser.dynamicTolerance(expected, 0.001, 0.02)
  );
}
