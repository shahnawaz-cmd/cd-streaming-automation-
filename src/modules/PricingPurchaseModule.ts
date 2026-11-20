import { expect, Page } from '@playwright/test';
import { CheckoutDecodedPayload, CheckoutPage } from '../pages/CheckoutPage';
import { PricingPage } from '../pages/pricing';
import { CdmaSearchPage } from '../pages/cdma/CdmaSearchPage';
import { EmailGenerator } from '../data/EmailGenerator';
import { STRIPE_TEST_CARD } from '../data/StripeTestCard';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

/** Stripe currencies charged in whole units (no x100 minor unit). */
const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

export interface StripeConfirmProof {
  httpStatus: number;
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  livemode: boolean;
  paymentMethodTypes: string[];
}

export interface UpdatePaymentProof {
  httpStatus: number;
  status: string;
  page: string;
  vin: string;
  vhrCredit: number;
  user: { id: string; email: string; country: string };
}

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
    const email = EmailGenerator.generate();

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
    const stripeConfirm = this.captureStripeConfirm();
    const updatePayment = this.captureUpdatePayment();
    await this.checkoutPage.payWithCard(STRIPE_TEST_CARD);
    const stripeProof = await stripeConfirm;
    const updatePaymentProof = await updatePayment;
    this.assertStripeConfirm(stripeProof, price, payload?.currency);
    this.assertUpdatePayment(updatePaymentProof, email);

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

  /** Stripe `POST /v1/payment_intents/{id}/confirm` response, reduced to non-sensitive fields (no client_secret). */
  private captureStripeConfirm(): Promise<StripeConfirmProof> {
    return this.page
      .waitForResponse((r) => r.request().method() === 'POST' && /api\.stripe\.com\/v1\/payment_intents\/[^/]+\/confirm/.test(r.url()))
      .then(async (r) => {
        const body = await r.json();
        return {
          httpStatus: r.status(),
          paymentIntentId: body.id,
          status: body.status,
          amount: body.amount,
          currency: String(body.currency).toUpperCase(),
          livemode: body.livemode,
          paymentMethodTypes: body.payment_method_types,
        };
      });
  }

  /** Site `GET /api/update-payment` response (credits granted after payment), without the account token. */
  private captureUpdatePayment(): Promise<UpdatePaymentProof> {
    return this.page
      .waitForResponse((r) => /\/api\/update-payment/.test(r.url()))
      .then(async (r) => {
        const body = await r.json();
        const { id, email, country } = body.data?.user ?? {};
        return {
          httpStatus: r.status(),
          status: body.status,
          page: body.data?.page,
          vin: body.data?.vin,
          vhrCredit: body.data?.vhr_credit,
          user: { id, email, country },
        };
      });
  }

  private assertStripeConfirm(proof: StripeConfirmProof, price: number, expectedCurrency?: string): void {
    expect(proof.httpStatus, 'Stripe confirm HTTP status').toBe(200);
    expect(proof.status, 'Stripe PaymentIntent status').toBe('succeeded');
    expect(proof.livemode, 'Stripe must be in test mode').toBe(false);
    // Charged amount is in minor units unless the currency is zero-decimal, so it works for any location currency
    const expectedAmount = ZERO_DECIMAL_CURRENCIES.has(proof.currency) ? Math.round(price) : Math.round(price * 100);
    expect(proof.amount, `Stripe amount (${proof.currency}) matches the pricing plan`).toBe(expectedAmount);
    if (expectedCurrency) expect(proof.currency, 'Stripe currency matches the checkout currency').toBe(expectedCurrency.toUpperCase());
  }

  private assertUpdatePayment(proof: UpdatePaymentProof, email: string): void {
    expect(proof.httpStatus, 'update-payment HTTP status').toBe(200);
    expect(proof.status, 'update-payment status').toBe('success');
    expect(proof.user.email, 'update-payment account email').toBe(email);
    expect(proof.vhrCredit, 'update-payment Report Credits').toBe(1);
  }

  /** The members area fills the balance in after load (and after the Stripe webhook), so poll the live counter. */
  private async expectReportCredits(expected: number): Promise<number> {
    await expect
      .poll(() => this.searchPage.reportCredits(), { message: 'Report Credits balance after payment' })
      .toBe(expected);
    return expected;
  }
}
