import { test } from '../src/fixtures';

// Independent of cd-streaming.spec.ts: shares only the fixtures and the one-time flow detection in global-setup.
test.describe('Pricing Page', () => {
  test('TC-PRICING-01: Pricing Page E2E - /pricing -> Checkout -> Stripe payment -> Report Credits', async ({ pricingPurchaseModule, evidenceModule }, testInfo) => {
    test.slow();
    const purchase = await test.step('Buy 1 Credit from /pricing with the Stripe test card', () => pricingPurchaseModule.purchaseSingleReport());
    await test.step('Attach Stripe confirm & update-payment API responses', () => evidenceModule.recordProof(testInfo, 'Pricing-Purchase-Proof', purchase));
  });
});
