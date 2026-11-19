import { test } from '../src/fixtures';
import { VinGenerator } from '../src/data/VinGenerator';

test.describe('CD Streaming - Preview & Checkout', () => {
  test('TC-01: Modern 17-char VIN - Dynamic handling for Decoded vs Not-Found fallback', async ({
    vinDecodeModule,
    modernDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = await VinGenerator.modernFromMongo();
    await test.step('Submit Modern VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => modernDecodeHandler.verifyOutcome(60_000));
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-02: Classic Mapped VIN - Dynamic handling for Decoded vs Manual YMMT fallback', async ({
    vinDecodeModule,
    classicDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = VinGenerator.classicMapped();
    await test.step('Submit Classic Mapped VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => classicDecodeHandler.verifyOutcome(60_000));
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-03: Exit-Intent & Coupon Guard - Banner applies coupon & blocks checkout until applied', async ({
    vinDecodeModule,
    modernDecodeHandler,
    exitIntentModule,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = await VinGenerator.modernFromMongo();
    await test.step('Submit Modern VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    await test.step('Wait for preview page decode completion', () => modernDecodeHandler.verifyOutcome(60_000));
    await test.step('Trigger exit-intent pop-up', () => exitIntentModule.triggerPopup());
    const result = await test.step('Claim discount and verify coupon guard', () => exitIntentModule.applyDiscountAndVerifyGuard());
    await test.step('Attach evidence', () => evidenceModule.recordExitIntentProof(testInfo, previewPage, vin, result));
  });

  test('TC-04: Invalid Modern VIN (Repeated Letter A-Z x17) - Dynamic Fallback vs Decoded', async ({
    vinDecodeModule,
    modernDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = VinGenerator.invalidModern17Random();
    await test.step(`Submit invalid Modern VIN (${vin}) on Homepage`, () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => modernDecodeHandler.verifyOutcome(60_000));
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-05: Invalid Classic VIN (Repeated Digit 0-9 x5) - Dynamic Fallback vs Decoded', async ({
    vinDecodeModule,
    classicDecodeHandler,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = VinGenerator.invalidClassic5Random();
    await test.step(`Submit invalid Classic VIN (${vin}) on Homepage`, () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => classicDecodeHandler.verifyOutcome(60_000));
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-06: Edit YMM - Dynamic selection with Trim field verification', async ({
    vinDecodeModule,
    classicDecodeHandler,
    editYmmModule,
    previewPage,
    evidenceModule,
  }, testInfo) => {
    const vin = VinGenerator.classicMapped();
    await test.step('Decode Classic VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    await test.step('Wait for decode & capture original specs JSON', async () => {
      await classicDecodeHandler.verifyOutcome(60_000);
      await evidenceModule.recordOriginalSpecsProof(testInfo, previewPage, vin);
    });
    const updated = await test.step('Dynamic YMMT selection with Trim verification', () => editYmmModule.updateDynamicYmmt());
    await test.step('Capture modified YMMT & URL JSON', () =>
      evidenceModule.recordModifiedYmmProof(testInfo, previewPage, vin, updated)
    );
  });
});
