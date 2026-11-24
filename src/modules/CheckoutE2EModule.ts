import { expect, Frame, Page, TestInfo } from '@playwright/test';
import { CheckoutDecodedPayload, CheckoutPage } from '../pages/CheckoutPage';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { ExitIntentModalComponent } from '../pages/preview/ExitIntentModalComponent';
import { CdmaSearchPage, CdmaVinPurchaseLanding } from '../pages/cdma/CdmaSearchPage';
import { VinDecodeModule } from './VinDecodeModule';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { EvidenceModule } from './EvidenceModule';
import { EmailGenerator } from '../data/EmailGenerator';
import { STRIPE_TEST_CARD } from '../data/StripeTestCard';
import { PriceParser } from '../utils/PriceParser';
import {
  StripePaymentCapture,
  StripeConfirmProof,
  UpdatePaymentProof,
} from '../utils/StripePaymentCapture';
import { Logger } from '../utils/Logger';

export interface ModernVinCheckoutE2EResult {
  vin: string;
  vehicleTitle: string;
  email: string;
  planLabel: string;
  planCount: number;
  previewPrice: number;
  currencyToken: string;
  checkoutPrice: number;
  checkoutPayload: CheckoutDecodedPayload | null;
  stripeConfirm: StripeConfirmProof;
  updatePayment: UpdatePaymentProof;
  successPage: {
    pathname: string;
    redirectStatus?: string;
    vin?: string;
    type?: string;
    planCode?: string;
  } | null;
  cdmaLanding: CdmaVinPurchaseLanding;
}

/**
 * Layer 3: CheckoutE2EModule
 * End-to-end streaming purchase flow:
 * Homepage Modern VIN Decode -> Preview -> Checkout -> Stripe Test Card Payment -> Default CDMA Auto-Navigation.
 */
export class CheckoutE2EModule {
  private logger = new Logger('CheckoutE2EModule');

  constructor(
    private page: Page,
    private vinDecodeModule: VinDecodeModule,
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule,
    private checkoutPage: CheckoutPage,
    private cdmaSearchPage: CdmaSearchPage
  ) {}

  /**
   * Decodes a fresh Modern VIN from the homepage, transitions through Checkout,
   * pays via Stripe test card in test mode, and verifies default CDMA auto-navigation.
   */
  async runModernVinStripeCheckoutToCdma(testInfo?: TestInfo): Promise<ModernVinCheckoutE2EResult> {
    const vin = await this.previewCheckoutModule.decodeFreshModernVin((candidate) =>
      this.vinDecodeModule.decodeFromHomepage(candidate)
    );
    await expect(this.previewPage.header.packageAccessCta()).toBeEnabled();

    const vehicleTitle = await this.previewPage.getVehicleTitle();
    const plans = await this.previewPage.plans.readAllPlans();
    const selectedPlan = plans.find((p) => p.checked) ?? plans[0];

    const email = EmailGenerator.generateWithTimestamp();
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, () =>
      this.previewCheckoutModule.proceedToCheckoutViaAccessCta(email)
    );

    await this.checkoutPage.verifyLandedOnCheckout();
    const payload = this.checkoutPage.readDecodedPayload();
    expect(payload, 'Checkout decoded payload should be present').not.toBeNull();
    expect(payload?.vin, 'Checkout payload VIN').toBe(vin);
    expect(payload?.email, 'Checkout payload email').toBe(email);
    expect(payload?.type, 'Checkout payload product type').toBe('report');
    expect(payload?.nos, 'Checkout payload plan count').toBe(selectedPlan.count);
    if (typeof payload?.price === 'number') {
      PriceParser.assertAmountClose(payload.price, selectedPlan.totalAmount, 'Checkout payload price');
    }

    await expect(this.checkoutPage.orderSummarySection()).toBeVisible();
    const summaryText = (await this.checkoutPage.orderSummarySection().innerText()).replace(/\s+/g, ' ').trim();
    expect(summaryText, 'Checkout Order Summary contains VIN').toContain(vin);
    expect(summaryText, 'Checkout Order Summary contains plan report count').toMatch(
      new RegExp(`${selectedPlan.count}\\s+Reports?`, 'i')
    );

    await expect(this.checkoutPage.payButton()).toBeVisible();
    await expect(this.checkoutPage.payButton()).toBeEnabled();
    const payButtonText = (await this.checkoutPage.payButton().innerText()).replace(/\s+/g, ' ').trim();
    const parsedPay = PriceParser.parseLastPrice(payButtonText);
    PriceParser.assertAmountClose(parsedPay.amount, selectedPlan.totalAmount, 'Checkout Pay CTA amount');
    if (selectedPlan.currencyToken && parsedPay.currencyToken) {
      expect(parsedPay.currencyToken, 'Checkout Pay CTA currency matches Preview currency').toBe(
        selectedPlan.currencyToken
      );
    }

    const paymentCapture = StripePaymentCapture.start(this.page);
    let successPage: ModernVinCheckoutE2EResult['successPage'] = null;
    const onFrameNavigated = (frame: Frame) => {
      if (frame !== this.page.mainFrame()) return;
      try {
        const u = new URL(frame.url());
        if (!u.pathname.includes('/success-page') || successPage) return;
        successPage = {
          pathname: u.pathname,
          redirectStatus: u.searchParams.get('redirect_status') ?? undefined,
          vin: u.searchParams.get('vin') ?? undefined,
          type: u.searchParams.get('type') ?? undefined,
          planCode: u.searchParams.get('plan_code') ?? undefined,
        };
      } catch {
        // ignore non-HTTP frames
      }
    };
    this.page.on('framenavigated', onFrameNavigated);

    try {
      await this.checkoutPage.payWithCard(STRIPE_TEST_CARD);
      const { stripeConfirm, updatePayment } = await paymentCapture.waitForBoth();

      StripePaymentCapture.assertStripeConfirm(stripeConfirm, selectedPlan.totalAmount, payload?.currency);
      StripePaymentCapture.assertUpdatePayment(updatePayment, email, { expectedVin: vin });

      const cdmaLanding = await this.cdmaSearchPage.waitForVinPurchaseAutoNavigation(vin);
      if (testInfo) {
        const testId = EvidenceModule.testId(testInfo);
        const screenshot = await this.page.screenshot();
        await testInfo.attach(`${testId}-CDMA-Landing.png`, {
          body: screenshot,
          contentType: 'image/png',
        });
      }

      this.logger.pass(
        `Checkout E2E passed for VIN ${vin} (${email}) -> Stripe ${stripeConfirm.paymentIntentId} -> CDMA ${cdmaLanding.pathname}`
      );

      return {
        vin,
        vehicleTitle,
        email,
        planLabel: selectedPlan.label,
        planCount: selectedPlan.count,
        previewPrice: selectedPlan.totalAmount,
        currencyToken: parsedPay.currencyToken || selectedPlan.currencyToken,
        checkoutPrice: parsedPay.amount,
        checkoutPayload: payload,
        stripeConfirm,
        updatePayment,
        successPage,
        cdmaLanding,
      };
    } finally {
      this.page.off('framenavigated', onFrameNavigated);
    }
  }
}
