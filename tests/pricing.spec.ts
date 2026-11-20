import { test } from '../src/fixtures';
import { pickRegion } from '../src/data/RegionalPool';

// Independent of cd-streaming.spec.ts: shares only the fixtures and the one-time flow detection in global-setup.
test.describe('Pricing Page', () => {
  test('TC-PRICING-01: Pricing Page E2E - /pricing -> Checkout -> Stripe payment -> Report Credits', async ({ pricingPurchaseModule, evidenceModule }, testInfo) => {
    test.slow();
    const purchase = await test.step('Buy 1 Credit from /pricing with the Stripe test card', () => pricingPurchaseModule.purchaseSingleReport());
    await test.step('Attach Stripe confirm & update-payment API responses', () => evidenceModule.recordProof(testInfo, 'Pricing-Purchase-Proof', purchase));
  });

  test('TC-PRICING-02: Pricing Coupon - banner & discounted plan prices in Report and Build Sheet modes (dynamic %)', async ({ pricingCouponModule, evidenceModule }, testInfo) => {
    test.slow();
    const result = await test.step('Apply the get20 coupon and verify banner, coupon API and every plan price in both modes', () => pricingCouponModule.verifyCouponPricing('get20'));
    await test.step('Attach coupon pricing JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Pricing-Coupon-Proof', result));
  });

  test('TC-PRICING-03: Pricing Plans - Personal cards match the backend plans API (Report & Build Sheet)', async ({ pricingParityModule, evidenceModule }, testInfo) => {
    test.slow();
    const parity = await test.step('Compare every Personal plan card with /api/plans', () => pricingParityModule.verifyPersonalPlans());
    await test.step('Attach plan parity JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Pricing-Parity-Proof', parity));
  });

  test('TC-PRICING-04: Pricing Tabs - Personal / Business switching renders the right plans and restores Personal', async ({ pricingParityModule, evidenceModule }, testInfo) => {
    test.slow();
    const tabs = await test.step('Switch Personal -> Business -> Personal and compare each with /api/plans', () => pricingParityModule.verifyBusinessTabs());
    await test.step('Attach tab switching JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Pricing-Tabs-Proof', tabs));
  });

  test('TC-PRICING-05: Pricing FAQ - every accordion item expands/collapses and the sample report link navigates', async ({ pricingFaqModule, evidenceModule }, testInfo) => {
    test.slow();
    const faq = await test.step('Expand and collapse each FAQ item, then follow the sample report link', () => pricingFaqModule.verifyFaqAndSampleLink());
    await test.step('Attach FAQ JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Pricing-Faq-Proof', faq));
  });

  test('TC-PRICING-06: Regional Currency - geo cookies localize pricing to the region currency (random region)', async ({ pricingRegionalCurrencyModule, evidenceModule }, testInfo) => {
    test.slow();
    const region = pickRegion();
    const result = await test.step(`Simulate ${region.name} (${region.country}) and verify ${region.currency} pricing`, () => pricingRegionalCurrencyModule.verifyRegion(region));
    await test.step('Attach regional currency JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Pricing-Regional-Proof', result));
  });
});
