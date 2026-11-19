import { test, expect } from '../src/fixtures';
import { VinGenerator } from '../src/data/VinGenerator';

test.describe('CD Streaming - Preview & Checkout', () => {
  test('TC-01: Modern 17-char VIN - Dynamic handling for Decoded vs Not-Found fallback', async ({
    vinDecodeModule,
    modernDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    // Reverted back to live MongoDB Modern VIN
    const vin = await VinGenerator.modernFromMongo();

    await test.step('Submit Modern VIN on Homepage', async () => {
      await vinDecodeModule.decodeFromHomepage(vin);
    });

    const outcome = await test.step('Verify outcome (Decoded -> Enabled OR Not-Found -> Disabled)', async () => {
      return await modernDecodeHandler.verifyOutcome(60_000);
    });

    await test.step('Attach evidence', async () => {
      await evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome);
    });
  });

  test('TC-02: Classic Mapped VIN - Dynamic handling for Decoded vs Manual YMMT fallback', async ({
    vinDecodeModule,
    classicDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = VinGenerator.classicMapped();

    await test.step('Submit Classic Mapped VIN on Homepage', async () => {
      await vinDecodeModule.decodeFromHomepage(vin);
    });

    const outcome = await test.step('Verify outcome (Decoded -> Enabled OR Manual YMMT Fallback)', async () => {
      return await classicDecodeHandler.verifyOutcome(60_000);
    });

    await test.step('Attach evidence', async () => {
      await evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome);
    });
  });

  test('TC-03: Exit-Intent & Coupon Guard - Exit-intent banner applies coupon & blocks checkout until applied', async ({
    vinDecodeModule,
    modernDecodeHandler,
    exitIntentModule,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = await VinGenerator.modernFromMongo();

    await test.step('Submit Modern VIN on Homepage', async () => {
      await vinDecodeModule.decodeFromHomepage(vin);
    });

    await test.step('Wait for preview page decode completion', async () => {
      await modernDecodeHandler.verifyOutcome(60_000);
    });

    await test.step('Trigger exit-intent pop-up on Preview page', async () => {
      await exitIntentModule.triggerPopup();
      await evidenceModule.captureElement(
        testInfo,
        previewPage.exitIntent.modalContainer(),
        'TC-03-Exit-Intent-Popup'
      );
    });

    const result = await test.step('Claim discount and verify coupon guard blocks checkout until applied', async () => {
      return await exitIntentModule.applyDiscountAndVerifyGuard();
    });

    await test.step('Attach evidence', async () => {
      await evidenceModule.recordExitIntentProof(testInfo, previewPage, vin, result);
    });
  });
});
