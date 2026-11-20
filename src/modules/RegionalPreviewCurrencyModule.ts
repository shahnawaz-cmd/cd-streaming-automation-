import { BrowserContext, expect, Page } from '@playwright/test';
import { RegionalConfig } from '../data/RegionalPool';
import { HomePage } from '../pages/home';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { fetchCreditPlans } from '../utils/PlansApi';
import { PriceParser } from '../utils/PriceParser';
import { assertLocalizedPlan, expectedCurrencySign, injectGeoCookies } from '../utils/RegionalCurrency';
import { Logger } from '../utils/Logger';

export interface PreviewPlanCurrency {
  plan: string;
  uiText: string;
  uiTotal: number;
  apiTotal: number;
}

export interface PreviewCurrencyResult {
  region: string;
  country: string;
  currency: string;
  expectedSign: string;
  vin: string;
  cta: { text: string; amount: number };
  plans: PreviewPlanCurrency[];
}

/**
 * Layer 3: RegionalPreviewCurrencyModule
 * Streaming flow in a simulated region: inject the geo cookies FIRST, decode a VIN on the homepage, land on
 * Preview, then the CTA and every plan must show the region's currency sign and the backend's converted amounts.
 */
export class RegionalPreviewCurrencyModule {
  private logger = new Logger('RegionalPreviewCurrencyModule');

  constructor(
    private page: Page,
    private context: BrowserContext,
    private homePage: HomePage,
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  async verifyPreviewCurrency(region: RegionalConfig): Promise<PreviewCurrencyResult> {
    await injectGeoCookies(this.context, region);
    this.logger.info(`Geo cookies injected: ${region.name} (${region.country}) -> expecting ${region.currency}`);

    const vin = await this.previewCheckoutModule.decodeFreshModernVin(async (candidate) => {
      await this.homePage.navigate('/');
      await this.homePage.fillVin(candidate);
      await this.homePage.clickSubmit();
      await this.homePage.waitForPreviewRedirect(candidate);
    });
    const cta = this.previewPage.header.packageAccessCta();
    await expect(cta).toBeVisible();

    // Backend truth for this visitor (page.request carries the injected cookies)
    const apiPlans = await fetchCreditPlans(this.page.request, 'vhr', 'user');
    apiPlans.forEach((plan) => assertLocalizedPlan(plan, region));

    const sign = expectedCurrencySign(region.currency);
    const plans = await this.verifyPlans(region, sign, apiPlans);
    const ctaResult = await this.verifyCta(region, sign);

    this.logger.pass(`Preview localized to ${region.name}: ${region.currency} (${sign}) on CTA and ${plans.length} plans`);
    return {
      region: region.name,
      country: region.country,
      currency: region.currency,
      expectedSign: sign,
      vin,
      cta: ctaResult,
      plans,
    };
  }

  private async verifyPlans(
    region: RegionalConfig,
    sign: string,
    apiPlans: Awaited<ReturnType<typeof fetchCreditPlans>>
  ): Promise<PreviewPlanCurrency[]> {
    const uiPlans = (await this.previewPage.plans.readAllPlans()).filter((p) => !p.isSubscription);
    expect(uiPlans.length, 'Preview shows credit plans').toBeGreaterThan(0);

    return uiPlans.map((ui) => {
      const api = apiPlans.find((p) => p.nos === ui.count);
      expect(api, `${region.name}: backend has a ${ui.count}-pack for the "${ui.label}" plan`).toBeDefined();
      expect(ui.totalRaw, `${region.name}: "${ui.label}" total shows the ${region.currency} sign "${sign}"`).toContain(sign);
      PriceParser.assertAmountClose(
        ui.totalAmount,
        api!.price,
        `${region.name} "${ui.label}" total vs backend`,
        PriceParser.dynamicTolerance(api!.price, 0.002, 0.02)
      );
      return { plan: ui.label, uiText: ui.totalRaw.replace(/\s+/g, ' ').trim(), uiTotal: ui.totalAmount, apiTotal: api!.price };
    });
  }

  private async verifyCta(region: RegionalConfig, sign: string): Promise<{ text: string; amount: number }> {
    const text = (await this.previewPage.header.packageAccessCta().innerText()).replace(/\s+/g, ' ').trim();
    expect(text, `${region.name}: Access CTA shows the ${region.currency} sign "${sign}"`).toContain(sign);

    const amount = PriceParser.parseLastPrice(text).amount;
    const selected = (await this.previewPage.plans.readAllPlans()).find((p) => p.checked && !p.isSubscription);
    if (selected) {
      PriceParser.assertAmountClose(
        amount,
        selected.totalAmount,
        `${region.name} CTA vs selected "${selected.label}" plan`,
        PriceParser.dynamicTolerance(selected.totalAmount, 0.002, 0.02)
      );
    }
    return { text, amount };
  }
}
