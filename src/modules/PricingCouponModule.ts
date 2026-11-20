import { expect, Page, Response } from '@playwright/test';
import { PlanCardSnapshot, PricingMode, PricingPage } from '../pages/pricing';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

const MODES: PricingMode[] = ['report', 'sticker'];

export interface PlanDiscountCheck {
  plan: string;
  baselineUnit: number;
  discountedUnit: number;
  baselineTotal: number;
  discountedTotal: number;
}

export interface PricingCouponResult {
  coupon: string;
  discountPercent: number;
  bannerText: string;
  modes: Record<PricingMode, PlanDiscountCheck[]>;
}

/**
 * Layer 3: PricingCouponModule
 * /pricing?offer=<coupon>: the banner percentage, the coupon API and every plan price (Report & Build Sheet)
 * must agree. The percentage is read from the site, never hard-coded.
 */
export class PricingCouponModule {
  private logger = new Logger('PricingCouponModule');

  constructor(
    private page: Page,
    private pricingPage: PricingPage
  ) {}

  async verifyCouponPricing(code = 'get20'): Promise<PricingCouponResult> {
    // 1. Baseline without a coupon
    await this.pricingPage.open();
    await expect(this.pricingPage.coupon.banner(), 'no coupon banner without the offer').toBeHidden();
    const baseline = await this.readAllModes();

    // 2. Same page with the coupon; capture the coupon API that drives the discount
    const validation = this.page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/landing/validate-coupon')
    );
    await this.pricingPage.openWithCoupon(code);
    const apiPercent = await this.readApiPercent(await validation);

    await expect(this.pricingPage.coupon.banner(), 'coupon banner shown').toBeVisible();
    const bannerText = await this.pricingPage.coupon.text();
    expect(await this.pricingPage.coupon.percent(), 'banner percentage matches the coupon API').toBe(apiPercent);
    this.logger.pass(`Coupon "${code}" -> ${apiPercent}% (banner "${bannerText}")`);

    // 3. Every plan, in both toggle modes, reflects the discount
    const modes = {} as PricingCouponResult['modes'];
    for (const mode of MODES) {
      await this.pricingPage.plans.selectMode(mode);
      await expect(this.pricingPage.coupon.banner(), `banner stays visible in ${mode} mode`).toBeVisible();
      const discounted = await this.readRepriced(mode, baseline[mode]);
      modes[mode] = this.compare(mode, baseline[mode], discounted, apiPercent);
      this.logger.pass(`${mode}: ${discounted.length} plans reflect ${apiPercent}% off`);
    }

    return { coupon: code, discountPercent: apiPercent, bannerText, modes };
  }

  private async readAllModes(): Promise<Record<PricingMode, PlanCardSnapshot[]>> {
    const result = {} as Record<PricingMode, PlanCardSnapshot[]>;
    for (const mode of MODES) {
      await this.pricingPage.plans.selectMode(mode);
      result[mode] = await this.pricingPage.plans.read();
    }
    return result;
  }

  /** The page re-prices asynchronously after the coupon API answers, so wait for the cards to change before reading. */
  private async readRepriced(mode: PricingMode, baseline: PlanCardSnapshot[]): Promise<PlanCardSnapshot[]> {
    await expect
      .poll(() => this.pricingPage.plans.read(), { message: `${mode} plans are re-priced by the coupon` })
      .not.toEqual(baseline);
    return this.pricingPage.plans.read();
  }

  private async readApiPercent(response: Response): Promise<number> {
    expect(response.status(), 'validate-coupon HTTP status').toBe(200);
    const body = await response.json();
    expect(body.status, 'validate-coupon status').toBe('success');
    const percent = Number(body.data?.off_on_purchase);
    expect(percent, 'validate-coupon off_on_purchase is a valid percentage').toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
    return percent;
  }

  private compare(
    mode: PricingMode,
    baseline: PlanCardSnapshot[],
    discounted: PlanCardSnapshot[],
    percent: number
  ): PlanDiscountCheck[] {
    expect(
      discounted.map((p) => p.name),
      `${mode}: same plans with and without the coupon`
    ).toEqual(baseline.map((p) => p.name));
    const factor = 1 - percent / 100;

    return discounted.map((plan, i) => {
      const base = baseline[i];
      const label = `${mode} / ${plan.name}`;
      expect(plan.currencyToken, `${label}: currency unchanged by the coupon`).toBe(base.currencyToken);
      for (const [kind, before, after] of [
        ['unit price', base.unitPrice, plan.unitPrice],
        ['total', base.totalPrice, plan.totalPrice],
      ] as const) {
        const expected = before * factor;
        // Tolerates the site's display rounding (2 decimals, or whole units for zero-decimal currencies)
        PriceParser.assertAmountClose(
          after,
          expected,
          `${label} ${kind} at ${percent}% off`,
          PriceParser.dynamicTolerance(expected, 0.005, 0.02)
        );
      }
      return {
        plan: plan.name,
        baselineUnit: base.unitPrice,
        discountedUnit: plan.unitPrice,
        baselineTotal: base.totalPrice,
        discountedTotal: plan.totalPrice,
      };
    });
  }
}
