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

  test('TC-E2E-02: Modern VIN Build Sheet Checkout E2E - /build-sheet Decode -> Preview -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', async ({ checkoutE2EModule, evidenceModule }, testInfo) => {
    test.slow();
    const result = await test.step('Decode Modern VIN on /build-sheet -> Preview -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', () =>
      checkoutE2EModule.runModernVinBuildSheetCheckoutToCdma(testInfo)
    );
    await test.step('Attach Build Sheet Checkout E2E JSON telemetry (Stripe & update-payment API proof)', () =>
      evidenceModule.recordProof(testInfo, 'BuildSheet-Checkout-E2E-Proof', result)
    );
  });

  test('TC-E2E-03: Modern VIN Unlimited Build Sheet Checkout E2E - /build-sheet Decode -> Preview (Unlimited Plan) -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', async ({ checkoutE2EModule, evidenceModule }, testInfo) => {
    test.slow();
    const result = await test.step('Decode Modern VIN on /build-sheet -> Select Unlimited Plan -> Checkout -> Stripe Payment -> CDMA Auto-Navigation', () =>
      checkoutE2EModule.runModernVinUnlimitedBuildSheetCheckoutToCdma(testInfo)
    );
    await test.step('Attach Unlimited Build Sheet Checkout E2E JSON telemetry (Stripe & update-payment API proof)', () =>
      evidenceModule.recordProof(testInfo, 'BuildSheet-Unlimited-Checkout-E2E-Proof', result)
    );
  });
});
