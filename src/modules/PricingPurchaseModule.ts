import { expect, Page } from '@playwright/test';
import { CheckoutDecodedPayload, CheckoutPage } from '../pages/CheckoutPage';
import { PricingPage } from '../pages/pricing';
import { CdmaSearchPage } from '../pages/cdma/CdmaSearchPage';
import { EmailGenerator } from '../data/EmailGenerator';
import { STRIPE_TEST_CARD } from '../data/StripeTestCard';
import { PriceParser } from '../utils/PriceParser';
import {
  StripePaymentCapture,
  StripeConfirmProof,
  UpdatePaymentProof,
} from '../utils/StripePaymentCapture';
import { Logger } from '../utils/Logger';

export type { StripeConfirmProof, UpdatePaymentProof };

export interface PricingPurchaseResult {
  plan: string;
  email: string;
  pricingPrice: number;
  currencyToken: string;
  checkoutPayload: CheckoutDecodedPayload | null;
  checkoutOrderSummary: string;
  payButtonAmount: number;
  stripeConfirm: StripeConfirmProof;
  updatePayment: UpdatePaymentProof;
  membersUrl: string;
  reportCreditsAfter: number;
}

/**
 * Layer 3: PricingPurchaseModule
 * /pricing -> "Get Your Report" email dialog -> Checkout -> Stripe test-card payment -> members credits.
 * Dev (Stripe test mode) only: it completes a real test-card payment.
 */
export class PricingPurchaseModule {
  private logger = new Logger('PricingPurchaseModule');

  constructor(
    private page: Page,
    private pricingPage: PricingPage,
    private checkoutPage: CheckoutPage,
    private searchPage: CdmaSearchPage
  ) {}

  /** Buys the single-report plan as a brand-new customer and verifies the 1 credit lands in the account. */
  async purchaseSingleReport(plan = '1 Credit'): Promise<PricingPurchaseResult> {
    const email = EmailGenerator.generateWithTimestamp();

    await this.pricingPage.open();
    const selected = (await this.pricingPage.plans.read()).find((p) => p.name === plan);
    if (!selected) throw new Error(`[PricingPurchaseModule] Plan "${plan}" not found on /pricing`);
    const { totalPrice: price, currencyToken } = selected;
    await this.pricingPage.startCheckout(plan, email);
    this.logger.pass(`Pricing -> Checkout (${plan}, ${email})`);

    // Checkout landing: payload, order summary and Pay CTA all agree with the plan clicked on /pricing
    await this.checkoutPage.verifyLandedOnCheckout();
    const payload = this.checkoutPage.readDecodedPayload();
    expect(payload, 'checkout URL carries the order payload').not.toBeNull();
    expect(payload).toMatchObject({ email, price, nos: 1, type: 'report', wpPage: 'pricingpage' });

    const orderSummary = (await this.checkoutPage.orderSummarySection().innerText()).replace(/\s+/g, ' ').trim();
    expect(orderSummary).toMatch(/1 Report/i);
    // Currency follows the visitor's location, so compare amount AND currency token rather than "$"
    const payButtonText = (await this.checkoutPage.payButton().innerText()).replace(/\s+/g, ' ').trim();
    const pay = PriceParser.parseLastPrice(payButtonText);
    const payButtonAmount = pay.amount;
    expect(payButtonAmount, 'Pay CTA amount matches the pricing plan').toBeCloseTo(price, 2);
    expect(pay.currencyToken, 'Pay CTA currency matches the pricing plan').toBe(currencyToken);
    expect(PriceParser.parseLastPrice(orderSummary).currencyToken, 'Order summary currency').toBe(currencyToken);

    // Register the response listeners BEFORE paying so neither API call can be missed
    const paymentCapture = StripePaymentCapture.start(this.page);
    await this.checkoutPage.payWithCard(STRIPE_TEST_CARD);
    const { stripeConfirm: stripeProof, updatePayment: updatePaymentProof } =
      await paymentCapture.waitForBoth();
    StripePaymentCapture.assertStripeConfirm(stripeProof, price, payload?.currency);
    StripePaymentCapture.assertUpdatePayment(updatePaymentProof, email, { expectedVhrCredit: 1 });

    await this.searchPage.waitForLanding();
    const reportCreditsAfter = await this.expectReportCredits(1);
    this.logger.pass(`Stripe payment succeeded -> ${this.page.url()} (Report Credits: ${reportCreditsAfter})`);

    return {
      plan,
      email,
      pricingPrice: price,
      currencyToken,
      checkoutPayload: payload,
      checkoutOrderSummary: orderSummary,
      payButtonAmount,
      stripeConfirm: stripeProof,
      updatePayment: updatePaymentProof,
      membersUrl: this.page.url(),
      reportCreditsAfter,
    };
  }

  /** The members area fills the balance in after load (and after the Stripe webhook), so poll the live counter. */
  private async expectReportCredits(expected: number): Promise<number> {
    await expect
      .poll(() => this.searchPage.reportCredits(), { message: 'Report Credits balance after payment' })
      .toBe(expected);
    return expected;
  }
}
