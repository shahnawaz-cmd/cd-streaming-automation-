import { test } from '../src/fixtures';

test.describe('Checkout E2E Flows', () => {
  test('TC-E2E-01: Modern VIN Checkout E2E - Homepage Decode -> Preview -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', async ({ checkoutE2EModule, evidenceModule }, testInfo) => {
    test.slow();
    const result = await test.step('Decode Modern VIN -> Preview -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', () =>
      checkoutE2EModule.runModernVinStripeCheckoutToCdma(testInfo)
    );
    await test.step('Attach Checkout E2E JSON telemetry (Stripe & update-payment API proof)', () =>
      evidenceModule.recordProof(testInfo, 'Checkout-E2E-Proof', result)
    );
  });
});
