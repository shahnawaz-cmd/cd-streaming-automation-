import { expect, Page } from '@playwright/test';

/** Stripe currencies charged in whole units (no x100 minor unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

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

/**
 * Layer 5: StripePaymentCapture
 * Captures and validates Stripe `payment_intents/{id}/confirm` and site `/api/update-payment`
 * responses during live test-mode payments, redacting sensitive secrets (`client_secret`, `token`).
 */
export class StripePaymentCapture {
  /**
   * Registers response listeners BEFORE submitting payment so neither API call can be missed.
   */
  static start(page: Page): {
    waitForStripeConfirm: () => Promise<StripeConfirmProof>;
    waitForUpdatePayment: () => Promise<UpdatePaymentProof>;
    waitForBoth: () => Promise<{
      stripeConfirm: StripeConfirmProof;
      updatePayment: UpdatePaymentProof;
    }>;
  } {
    const stripePromise: Promise<StripeConfirmProof> = page
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          /api\.stripe\.com\/v1\/payment_intents\/[^/]+\/confirm/.test(r.url())
      )
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

    const updatePaymentPromise: Promise<UpdatePaymentProof> = page
      .waitForResponse((r) => /\/api\/update-payment/.test(r.url()))
      .then(async (r) => {
        const body = await r.json();
        const { id, email, country } = body.data?.user ?? {};
        return {
          httpStatus: r.status(),
          status: body.status,
          page: body.data?.page,
          vin: body.data?.vin,
          vhrCredit: Number(body.data?.vhr_credit ?? 0),
          user: { id, email, country },
        };
      });

    return {
      waitForStripeConfirm: () => stripePromise,
      waitForUpdatePayment: () => updatePaymentPromise,
      waitForBoth: async () => {
        const [stripeConfirm, updatePayment] = await Promise.all([
          stripePromise,
          updatePaymentPromise,
        ]);
        return { stripeConfirm, updatePayment };
      },
    };
  }

  /**
   * Asserts Stripe test-mode PaymentIntent succeeded for the expected amount and currency.
   */
  static assertStripeConfirm(
    proof: StripeConfirmProof,
    expectedPrice: number,
    expectedCurrency?: string
  ): void {
    expect(proof.httpStatus, 'Stripe confirm HTTP status').toBe(200);
    expect(proof.status, 'Stripe PaymentIntent status').toBe('succeeded');
    expect(proof.livemode, 'Stripe must be in test mode').toBe(false);
    const expectedAmount = ZERO_DECIMAL_CURRENCIES.has(proof.currency)
      ? Math.round(expectedPrice)
      : Math.round(expectedPrice * 100);
    expect(proof.amount, `Stripe amount (${proof.currency}) matches expected price`).toBe(
      expectedAmount
    );
    if (expectedCurrency) {
      expect(proof.currency, 'Stripe currency matches checkout currency').toBe(
        expectedCurrency.toUpperCase()
      );
    }
  }

  /**
   * Asserts `/api/update-payment` completed cleanly for the expected user (and optional VIN/credit).
   */
  static assertUpdatePayment(
    proof: UpdatePaymentProof,
    expectedEmail: string,
    options?: { expectedVin?: string; expectedVhrCredit?: number }
  ): void {
    expect(proof.httpStatus, 'update-payment HTTP status').toBe(200);
    expect(proof.status, 'update-payment status').toBe('success');
    expect(proof.user.email, 'update-payment account email').toBe(expectedEmail);
    if (options?.expectedVin && proof.vin) {
      expect(proof.vin, 'update-payment VIN').toBe(options.expectedVin);
    }
    if (options?.expectedVhrCredit !== undefined) {
      expect(proof.vhrCredit, 'update-payment Report Credits').toBe(options.expectedVhrCredit);
    }
  }
}
