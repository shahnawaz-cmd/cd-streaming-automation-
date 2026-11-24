import { expect, Frame, Page, TestInfo } from '@playwright/test';
import { BuildSheetPage } from '../pages/BuildSheetPage';
import { CheckoutDecodedPayload, CheckoutPage } from '../pages/CheckoutPage';
import { PlanOptionInfo } from '../pages/preview/PlansComponent';
import { PreviewPage, PreviewType } from '../pages/preview/PreviewPage';
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
  entryPath: '/' | '/build-sheet';
  previewType: PreviewType;
  isSubscription: boolean;
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

interface CheckoutFlowConfig {
  entryPath: '/' | '/build-sheet';
  previewType: PreviewType;
  expectedCheckoutType: 'report' | 'sticker';
  expectedSubscription: boolean;
  selectPlan?: (plans: PlanOptionInfo[]) => PlanOptionInfo;
  summaryItemPattern: (plan: PlanOptionInfo) => RegExp;
  decode: (vin: string) => Promise<void>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Layer 3: CheckoutE2EModule
 * End-to-end streaming purchase flows:
 * - Homepage ('/') Modern VIN Decode -> Preview (vhr) -> Checkout -> Stripe Payment -> CDMA Auto-Navigation
 * - Build Sheet ('/build-sheet') Modern VIN Decode -> Preview (sticker) -> Checkout -> Stripe Payment -> CDMA Auto-Navigation
 * - Build Sheet ('/build-sheet') Unlimited/Subscription Plan -> Preview (sticker) -> Checkout -> Stripe Payment -> CDMA Auto-Navigation
 */
export class CheckoutE2EModule {
  private logger = new Logger('CheckoutE2EModule');

  constructor(
    private page: Page,
    private vinDecodeModule: VinDecodeModule,
    private buildSheetPage: BuildSheetPage,
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule,
    private checkoutPage: CheckoutPage,
    private cdmaSearchPage: CdmaSearchPage
  ) {}

  private async runModernVinCheckoutFlow(
    config: CheckoutFlowConfig,
    testInfo?: TestInfo
  ): Promise<ModernVinCheckoutE2EResult> {
    const vin = await this.previewCheckoutModule.decodeFreshModernVin(config.decode);
    await expect(this.previewPage.header.packageAccessCta()).toBeEnabled();

    const vehicleTitle = await this.previewPage.getVehicleTitle();
    const plans = await this.previewPage.plans.readAllPlans();
    const selectedPlan = config.selectPlan
      ? config.selectPlan(plans)
      : (plans.find((p) => p.checked) ?? plans[0]);

    if (!selectedPlan.checked) {
      await this.previewPage.plans.selectPlanByIndex(selectedPlan.index);
      const cta = this.previewPage.header.packageAccessCta();
      await expect(cta).toBeEnabled();
      await expect(async () => {
        const parsed = PriceParser.parseLastPrice(await cta.innerText());
        PriceParser.assertAmountClose(
          parsed.amount,
          selectedPlan.totalAmount,
          `Preview CTA after selecting "${selectedPlan.label}"`
        );
      }).toPass();
    }

    const email = EmailGenerator.generateWithTimestamp();
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, () =>
      this.previewCheckoutModule.proceedToCheckoutViaAccessCta(email)
    );

    await this.checkoutPage.verifyLandedOnCheckout();
    const payload = this.checkoutPage.readDecodedPayload();
    expect(payload, 'Checkout decoded payload should be present').not.toBeNull();
    expect(payload?.vin, 'Checkout payload VIN').toBe(vin);
    expect(payload?.email, 'Checkout payload email').toBe(email);
    expect(payload?.type, 'Checkout payload product type').toBe(config.expectedCheckoutType);
    expect(Boolean(payload?.subscription), 'Checkout payload subscription flag').toBe(
      config.expectedSubscription
    );
    if (!config.expectedSubscription) {
      expect(payload?.nos, 'Checkout payload plan count').toBe(selectedPlan.count);
    }
    if (typeof payload?.price === 'number') {
      PriceParser.assertAmountClose(payload.price, selectedPlan.totalAmount, 'Checkout payload price');
    }

    await expect(this.checkoutPage.orderSummarySection()).toBeVisible();
    const summaryText = (await this.checkoutPage.orderSummarySection().innerText()).replace(/\s+/g, ' ').trim();
    expect(summaryText, 'Checkout Order Summary contains VIN').toContain(vin);
    expect(summaryText, 'Checkout Order Summary matches selected package').toMatch(
      config.summaryItemPattern(selectedPlan)
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

      const cdmaLanding = await this.cdmaSearchPage.waitForVinPurchaseAutoNavigation(
        vin,
        config.previewType
      );
      if (testInfo) {
        const testId = EvidenceModule.testId(testInfo);
        const screenshot = await this.page.screenshot();
        await testInfo.attach(`${testId}-CDMA-Landing.png`, {
          body: screenshot,
          contentType: 'image/png',
        });
      }

      this.logger.pass(
        `Checkout E2E (${config.entryPath} -> ${config.previewType}${config.expectedSubscription ? ' subscription' : ''}) passed for VIN ${vin} (${email}) -> Stripe ${stripeConfirm.paymentIntentId} -> CDMA ${cdmaLanding.pathname}`
      );

      return {
        entryPath: config.entryPath,
        previewType: config.previewType,
        isSubscription: config.expectedSubscription,
        vin,
        vehicleTitle,
        email,
        planLabel: selectedPlan.label,
        planCount: payload?.nos ?? selectedPlan.count,
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

  /** Report (VHR) Checkout E2E from homepage '/'. */
  runModernVinStripeCheckoutToCdma(testInfo?: TestInfo): Promise<ModernVinCheckoutE2EResult> {
    return this.runModernVinCheckoutFlow(
      {
        entryPath: '/',
        previewType: 'vhr',
        expectedCheckoutType: 'report',
        expectedSubscription: false,
        summaryItemPattern: (plan) => new RegExp(`${plan.count}\\s+Reports?`, 'i'),
        decode: (vin) => this.vinDecodeModule.decodeFromHomepage(vin),
      },
      testInfo
    );
  }

  /** Build Sheet (Sticker) Checkout E2E from '/build-sheet'. */
  runModernVinBuildSheetCheckoutToCdma(testInfo?: TestInfo): Promise<ModernVinCheckoutE2EResult> {
    return this.runModernVinCheckoutFlow(
      {
        entryPath: '/build-sheet',
        previewType: 'sticker',
        expectedCheckoutType: 'sticker',
        expectedSubscription: false,
        summaryItemPattern: (plan) =>
          new RegExp(`${plan.count}\\s+(?:Build\\s+Sheets?|Window\\s+Stickers?|Stickers?)`, 'i'),
        decode: (vin) => this.buildSheetPage.submitVinAndWaitForPreview(vin),
      },
      testInfo
    );
  }

  /** Unlimited/Subscription Build Sheet (Sticker) Checkout E2E from '/build-sheet'. */
  runModernVinUnlimitedBuildSheetCheckoutToCdma(
    testInfo?: TestInfo
  ): Promise<ModernVinCheckoutE2EResult> {
    return this.runModernVinCheckoutFlow(
      {
        entryPath: '/build-sheet',
        previewType: 'sticker',
        expectedCheckoutType: 'sticker',
        expectedSubscription: true,
        selectPlan: (plans) => {
          const subPlan =
            plans.find((p) => p.isSubscription) ??
            plans.find((p) => /unlimited|subscription/i.test(`${p.label} ${p.unitLabel}`));
          if (!subPlan) {
            throw new Error(
              `[CheckoutE2EModule] Unlimited/Subscription Build Sheet plan not found among: ${plans.map((p) => p.label).join(', ')}`
            );
          }
          return subPlan;
        },
        summaryItemPattern: (plan) =>
          new RegExp(`${escapeRegExp(plan.label)}|Unlimited|Subscription|Build\\s+Sheet|Sticker`, 'i'),
        decode: (vin) => this.buildSheetPage.submitVinAndWaitForPreview(vin),
      },
      testInfo
    );
  }
}
