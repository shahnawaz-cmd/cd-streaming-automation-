import { expect, Page } from '@playwright/test';
import { CheckoutPage, CheckoutOrderSummary } from '../pages/CheckoutPage';
import { ExitIntentModalComponent } from '../pages/preview/ExitIntentModalComponent';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { PlanAndUpsellSelectionResult } from './PlanSelectionModule';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

export interface CheckoutPriceSyncResult {
  usedEmail: string;
  checkoutUrl: string;
  summary: CheckoutOrderSummary;
}

/**
 * Layer 3: CheckoutPriceSyncModule
 * Separate Checkout verification module asserting that selected plan price,
 * upsell add-on price, Order Summary total, Pay CTA, currency token, and URL payload
 * remain 100% synchronized from Preview to Checkout.
 */
export class CheckoutPriceSyncModule {
  private logger = new Logger('CheckoutPriceSyncModule');

  constructor(
    private page: Page,
    private previewCheckoutModule: PreviewCheckoutModule,
    private checkoutPage: CheckoutPage
  ) {}

  /**
   * Navigates Preview -> Checkout and validates currency-agnostic Order Summary & Pay CTA price sync.
   */
  async proceedAndVerifyPriceSync(
    selection: PlanAndUpsellSelectionResult
  ): Promise<CheckoutPriceSyncResult> {
    const { usedEmail, checkoutUrl } = await ExitIntentModalComponent.runWithOverlayGuard(
      this.page,
      () => this.previewCheckoutModule.proceedToCheckoutViaAccessCta()
    );

    const summary = await this.checkoutPage.readOrderSummary();

    PriceParser.assertAmountClose(
      summary.packageAmount,
      selection.selectedPlan.totalAmount,
      'Checkout Order Summary PACKAGE amount'
    );
    PriceParser.assertAmountClose(
      summary.addOnAmount,
      selection.upsell.activePriceAmount,
      'Checkout Order Summary ADD-ON amount'
    );
    PriceParser.assertAmountClose(
      summary.totalAmount,
      selection.previewCtaAfterUpsell,
      'Checkout Order Summary Total amount'
    );
    PriceParser.assertAmountClose(
      summary.payButtonAmount,
      selection.previewCtaAfterUpsell,
      'Checkout Pay CTA button amount'
    );

    if (selection.currencyToken && summary.currencyToken) {
      expect(
        summary.currencyToken,
        'Checkout currency token should match Preview currency token'
      ).toBe(selection.currencyToken);
    }

    if (summary.decodedData) {
      expect(summary.decodedData.vin, 'Checkout URL payload vin').toBe(selection.vin);
      expect(summary.decodedData.extra, 'Checkout URL payload upsell flag (extra)').toBe(true);
      expect(summary.decodedData.nos, 'Checkout URL payload plan count (nos)').toBe(
        selection.selectedPlan.count
      );
      if (typeof summary.decodedData.price === 'number') {
        PriceParser.assertAmountClose(
          summary.decodedData.price,
          selection.selectedPlan.totalAmount,
          'Checkout URL payload package price'
        );
      }
      if (typeof summary.decodedData.addOnPrice === 'number') {
        PriceParser.assertAmountClose(
          summary.decodedData.addOnPrice,
          selection.upsell.activePriceAmount,
          'Checkout URL payload addOnPrice'
        );
      }
    }

    this.logger.pass(
      `Checkout price sync verified (${usedEmail}): PACKAGE=${summary.packageAmount}, ADD-ON=${summary.addOnAmount}, Total=${summary.totalAmount}, PayBtn="${summary.payButtonText}"`
    );

    return {
      usedEmail,
      checkoutUrl,
      summary,
    };
  }
}
