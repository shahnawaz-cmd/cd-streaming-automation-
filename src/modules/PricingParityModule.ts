import { expect, Page } from '@playwright/test';
import { PlanCardSnapshot, PricingAudience, PricingMode, PricingPage } from '../pages/pricing';
import { fetchCreditPlans, PlanApiItem, PlansKind, PlansUserType } from '../utils/PlansApi';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

const MODES: PricingMode[] = ['report', 'sticker'];
const KIND: Record<PricingMode, PlansKind> = { report: 'vhr', sticker: 'sticker' };
const USER_TYPE: Record<PricingAudience, PlansUserType> = { personal: 'user', business: 'dealer' };

export interface PlanParity {
  plan: string;
  apiTotal: number;
  uiTotal: number;
  apiUnit: number;
  uiUnit: number;
}

export type AudienceParity = Record<PricingMode, PlanParity[]>;

export interface BusinessTabResult {
  personal: AudienceParity;
  business: AudienceParity;
  personalRestored: AudienceParity;
}

/**
 * Layer 3: PricingParityModule
 * The plan cards on /pricing must be exactly the plans the backend serves (`/api/plans`), for every
 * audience (Personal / Business) and product (Report / Build Sheet): same quantities, totals and unit prices.
 */
export class PricingParityModule {
  private logger = new Logger('PricingParityModule');

  constructor(
    private page: Page,
    private pricingPage: PricingPage
  ) {}

  /** Personal plans (default tab) in both Report and Build Sheet modes. */
  async verifyPersonalPlans(): Promise<AudienceParity> {
    await this.openHydrated();
    return this.verifyAudience('personal');
  }

  /** Personal -> Business -> Personal: each tab shows its own backend plans and Personal is restored. */
  async verifyBusinessTabs(): Promise<BusinessTabResult> {
    await this.openHydrated();
    const personal = await this.verifyAudience('personal');

    await this.pricingPage.plans.selectAudience('business');
    const business = await this.verifyAudience('business');
    expect(this.fingerprint(business), 'Business tab shows different plans than Personal').not.toEqual(this.fingerprint(personal));

    await this.pricingPage.plans.selectAudience('personal');
    const personalRestored = await this.verifyAudience('personal');
    expect(this.fingerprint(personalRestored), 'Personal plans are restored after switching back').toEqual(this.fingerprint(personal));

    this.logger.pass('Personal -> Business -> Personal tabs render the matching backend plans');
    return { personal, business, personalRestored };
  }

  /** The cards are client-rendered, so waiting for them also guarantees the page is hydrated and interactive. */
  private async openHydrated(): Promise<void> {
    await this.pricingPage.open();
    await expect(this.pricingPage.plans.cards().first()).toBeVisible();
  }

  private async verifyAudience(audience: PricingAudience): Promise<AudienceParity> {
    const result = {} as AudienceParity;
    for (const mode of MODES) {
      await this.pricingPage.plans.selectMode(mode);
      const api = await fetchCreditPlans(this.page.request, KIND[mode], USER_TYPE[audience]);
      const ui = await this.pricingPage.plans.read();
      result[mode] = this.compare(`${audience} / ${mode}`, api, ui);
      this.logger.pass(`${audience} / ${mode}: ${ui.length} cards match /api/plans`);
    }
    return result;
  }

  private compare(label: string, api: PlanApiItem[], ui: PlanCardSnapshot[]): PlanParity[] {
    expect(ui, `${label}: number of cards equals number of API plans`).toHaveLength(api.length);

    return api.map((plan) => {
      const card = ui.find((c) => Number(c.name.match(/^\d+/)?.[0]) === plan.nos);
      expect(card, `${label}: a card exists for the ${plan.nos}-pack`).toBeDefined();
      const unit = plan.price / plan.nos;
      PriceParser.assertAmountClose(card!.totalPrice, plan.price, `${label} ${plan.nos}-pack total`, PriceParser.dynamicTolerance(plan.price, 0.002, 0.02));
      PriceParser.assertAmountClose(card!.unitPrice, unit, `${label} ${plan.nos}-pack unit price`, PriceParser.dynamicTolerance(unit, 0.01, 0.02));
      return { plan: card!.name, apiTotal: plan.price, uiTotal: card!.totalPrice, apiUnit: unit, uiUnit: card!.unitPrice };
    });
  }

  /** Order-independent identity of an audience's plans, to prove two tabs really differ (or match). */
  private fingerprint(parity: AudienceParity): string[] {
    return MODES.flatMap((mode) => parity[mode].map((p) => `${mode}:${p.plan}:${p.apiTotal}`)).sort();
  }
}
