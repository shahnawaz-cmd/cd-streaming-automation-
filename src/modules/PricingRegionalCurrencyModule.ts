import { BrowserContext, expect, Page } from '@playwright/test';
import { RegionalConfig } from '../data/RegionalPool';
import { PricingPage } from '../pages/pricing';
import { PlanApiItem, toPlanApiItem } from '../utils/PlansApi';
import { PriceParser } from '../utils/PriceParser';
import { assertLocalizedPlan, injectGeoCookies } from '../utils/RegionalCurrency';
import { Logger } from '../utils/Logger';

export interface RegionalCurrencyResult {
  region: string;
  country: string;
  ip: string;
  currency: string;
  plan: string;
  usdPrice: number;
  conversionRate: number | undefined;
  apiPrice: number;
  uiNumbers: number[];
}

/**
 * Layer 3: PricingRegionalCurrencyModule
 * Injecting a visitor's geo cookies (`cwa_ip` / `cwa_country`) must localize /pricing: the plans API answers
 * in that region's currency at `usd_price x conversion_rate`, and the card on screen shows that same amount.
 */
export class PricingRegionalCurrencyModule {
  private logger = new Logger('PricingRegionalCurrencyModule');

  constructor(
    private page: Page,
    private context: BrowserContext,
    private pricingPage: PricingPage
  ) {}

  async verifyRegion(region: RegionalConfig): Promise<RegionalCurrencyResult> {
    await injectGeoCookies(this.context, region);
    this.logger.info(`Geo cookies injected: ${region.name} (${region.country}, ${region.ip})`);

    // The call the page itself makes (not a side request), so it proves the UI was priced for this region
    const plansResponse = this.page.waitForResponse(
      (r) => r.url().includes('/api/plans?kind=vhr&user_type=user') && r.request().method() === 'GET'
    );
    await this.pricingPage.open();
    const response = await plansResponse;
    expect(response.status(), 'page /api/plans HTTP status').toBe(200);
    const apiPlans: PlanApiItem[] = ((await response.json()).credit_plans ?? []).map(toPlanApiItem);
    expect(apiPlans.length, 'regional plans returned').toBeGreaterThan(0);

    apiPlans.forEach((plan) => assertLocalizedPlan(plan, region));

    // UI: the card of the smallest pack shows the API amount (compared numerically: works for any currency symbol)
    const plan = apiPlans.reduce((smallest, p) => (p.nos < smallest.nos ? p : smallest));
    const card = this.pricingPage.plans.cardByCount(plan.nos);
    await expect(card, `${region.name}: ${plan.nos}-pack card rendered`).toBeVisible();
    const uiNumbers = PriceParser.numbersIn(await card.innerText());
    const shown = uiNumbers.some((n) => Math.abs(n - plan.price) <= PriceParser.dynamicTolerance(plan.price, 0.002, 0.02));
    expect(shown, `${region.name}: card shows ${plan.price} ${region.currency} (saw ${uiNumbers.join(', ')})`).toBe(true);

    this.logger.pass(`${region.name} (${region.country}) -> ${region.currency}: ${plan.nos}-pack = ${plan.price}`);
    return {
      region: region.name,
      country: region.country,
      ip: region.ip,
      currency: region.currency,
      plan: `${plan.nos}-pack`,
      usdPrice: plan.usdPrice,
      conversionRate: plan.conversionRate,
      apiPrice: plan.price,
      uiNumbers,
    };
  }
}
