import { expect } from '@playwright/test';
import { PreviewPage, PreviewType } from '../pages/preview/PreviewPage';
import { PlanOptionInfo } from '../pages/preview/PlansComponent';
import { UpsellSnapshot } from '../pages/preview/UpsellComponent';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { VinGenerator } from '../data/VinGenerator';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

export interface PlanAndUpsellSelectionResult {
  vin: string;
  previewType: PreviewType;
  availablePlans: PlanOptionInfo[];
  selectedPlan: PlanOptionInfo;
  upsell: UpsellSnapshot;
  previewCtaAfterPlan: number;
  previewCtaAfterUpsell: number;
  currencyToken: string;
}

/**
 * Layer 3: PlanSelectionModule
 * Dedicated to dynamic Preview plan selection + upsell checkbox activation
 * and currency-agnostic Preview CTA price synchronization.
 */
export class PlanSelectionModule {
  private logger = new Logger('PlanSelectionModule');

  constructor(
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  private async decodeFreshModernVin(previewType: PreviewType): Promise<string> {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const vin = await VinGenerator.modernFromMongo();
      await this.previewPage.openDirectly(vin, previewType);
      const outcome = await this.previewCheckoutModule.waitForLocalizedDecodeOutcome();
      if (outcome === 'DECODED') {
        this.logger.pass(`Decoded Modern VIN ${vin} on Preview (${previewType}, attempt ${attempt})`);
        return vin;
      }
      this.logger.warn(`Attempt ${attempt}/${maxAttempts}: Modern VIN ${vin} returned NOT_FOUND, retrying...`);
    }
    throw new Error(`[PlanSelectionModule] Failed to decode Modern VIN after ${maxAttempts} attempts`);
  }

  /**
   * Decodes a Modern VIN, selects a non-default plan dynamically, enables the upsell checkbox,
   * and verifies currency-agnostic Preview CTA price updates at each step.
   */
  async selectPlanAndEnableUpsell(
    previewType: PreviewType = 'vhr'
  ): Promise<PlanAndUpsellSelectionResult> {
    const vin = await this.decodeFreshModernVin(previewType);
    const availablePlans = await this.previewPage.plans.readAllPlans();
    expect(availablePlans.length, 'Expected multiple pricing plans on Preview page').toBeGreaterThanOrEqual(2);

    const targetPlan = availablePlans.find((p) => !p.checked) ?? availablePlans[0];
    await this.previewPage.plans.selectPlanByIndex(targetPlan.index);

    const cta = this.previewPage.header.packageAccessCta();
    await expect(cta).toBeEnabled();

    let previewCtaAfterPlan = targetPlan.totalAmount;
    let currencyToken = targetPlan.currencyToken;
    await expect(async () => {
      const parsed = PriceParser.parseLastPrice(await cta.innerText());
      previewCtaAfterPlan = parsed.amount;
      if (parsed.currencyToken) currencyToken = parsed.currencyToken;
      PriceParser.assertAmountClose(
        previewCtaAfterPlan,
        targetPlan.totalAmount,
        `Preview CTA after selecting "${targetPlan.label}"`
      );
    }).toPass();

    const upsellBefore = await this.previewPage.upsell.readSnapshot();
    await this.previewPage.upsell.toggleOn();
    const upsell = await this.previewPage.upsell.readSnapshot();

    const expectedWithUpsell = targetPlan.totalAmount + upsellBefore.activePriceAmount;
    let previewCtaAfterUpsell = expectedWithUpsell;
    await expect(async () => {
      const parsed = PriceParser.parseLastPrice(await cta.innerText());
      previewCtaAfterUpsell = parsed.amount;
      if (parsed.currencyToken) currencyToken = parsed.currencyToken;
      PriceParser.assertAmountClose(
        previewCtaAfterUpsell,
        expectedWithUpsell,
        `Preview CTA after enabling upsell "${upsell.title}"`
      );
    }).toPass();

    this.logger.pass(
      `Plan "${targetPlan.label}" (${targetPlan.totalAmount}) + Upsell "${upsell.title}" (${upsell.activePriceAmount}) -> Preview CTA ${previewCtaAfterUpsell} (${currencyToken})`
    );

    return {
      vin,
      previewType,
      availablePlans,
      selectedPlan: targetPlan,
      upsell,
      previewCtaAfterPlan,
      previewCtaAfterUpsell,
      currencyToken,
    };
  }
}
