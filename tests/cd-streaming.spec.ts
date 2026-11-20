import { test } from '../src/fixtures';
import { VinGenerator } from '../src/data/VinGenerator';

test.describe('CD Streaming - Preview & Checkout', () => {
  test('TC-01: Modern 17-char VIN - Dynamic handling for Decoded vs Not-Found fallback', async ({ vinDecodeModule, modernDecodeHandler, previewPage, evidenceModule }, testInfo) => {
    const vin = await VinGenerator.modernFromMongo();
    await test.step('Submit Modern VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => modernDecodeHandler.verifyOutcome());
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-02: Classic Mapped VIN - Dynamic handling for Decoded vs Manual YMMT fallback', async ({ vinDecodeModule, classicDecodeHandler, previewPage, evidenceModule }, testInfo) => {
    const vin = VinGenerator.classicMapped();
    await test.step('Submit Classic Mapped VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => classicDecodeHandler.verifyOutcome());
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-03: Exit-Intent & Coupon Guard - Banner applies coupon & blocks checkout until applied', async ({ vinDecodeModule, modernDecodeHandler, exitIntentModule, previewPage, evidenceModule }, testInfo) => {
    const vin = await VinGenerator.modernFromMongo();
    await test.step('Submit Modern VIN on Homepage', () => vinDecodeModule.decodeFromHomepage(vin));
    await test.step('Wait for preview page decode completion', () => modernDecodeHandler.verifyOutcome());
    await test.step('Trigger exit-intent pop-up', () => exitIntentModule.triggerPopup());
    const result = await test.step('Claim discount and verify coupon guard', () => exitIntentModule.applyDiscountAndVerifyGuard());
    await test.step('Attach evidence', () => evidenceModule.recordExitIntentProof(testInfo, previewPage, vin, result));
  });

  test('TC-04: Invalid Modern VIN (Repeated Letter A-Z x17) - Dynamic Fallback vs Decoded', async ({ vinDecodeModule, modernDecodeHandler, previewPage, evidenceModule }, testInfo) => {
    const vin = VinGenerator.invalidModern17Random();
    await test.step(`Submit invalid Modern VIN (${vin}) on Homepage`, () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => modernDecodeHandler.verifyOutcome());
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-05: Invalid Classic VIN (Repeated Digit 0-9 x5) - Dynamic Fallback vs Decoded', async ({ vinDecodeModule, classicDecodeHandler, previewPage, evidenceModule }, testInfo) => {
    const vin = VinGenerator.invalidClassic5Random();
    await test.step(`Submit invalid Classic VIN (${vin}) on Homepage`, () => vinDecodeModule.decodeFromHomepage(vin));
    const outcome = await test.step('Verify outcome', () => classicDecodeHandler.verifyOutcome());
    await test.step('Attach evidence', () => evidenceModule.recordPreviewProof(testInfo, previewPage, vin, outcome));
  });

  test('TC-06: Edit YMM - Dynamic selection with Trim field verification', async ({ vinDecodeModule, editYmmModule, previewPage, evidenceModule }, testInfo) => {
    const vin = await test.step('Decode Classic Mapped VIN & capture original JSON', () => vinDecodeModule.decodeClassicMappedWithProof(testInfo));
    const updated = await test.step('Dynamic YMMT selection with Trim verification', () => editYmmModule.updateDynamicYmmt());
    await test.step('Capture modified YMMT & URL JSON', () => evidenceModule.recordModifiedYmmProof(testInfo, previewPage, vin, updated));
  });

  test('TC-07: Edit Specifications - Dynamic specs update with before/after JSON telemetry', async ({ vinDecodeModule, editSpecsModule, previewPage, evidenceModule }, testInfo) => {
    const vin = await test.step('Decode Classic Mapped VIN & capture original JSON', () => vinDecodeModule.decodeClassicMappedWithProof(testInfo));
    const updatedSpecs = await test.step('Update specifications dynamically', () => editSpecsModule.updateDynamicSpecs());
    await test.step('Capture modified specifications & URL JSON', () => evidenceModule.recordModifiedSpecsProof(testInfo, previewPage, vin, updatedSpecs));
  });

  test('TC-08: Multi-Language Localization - Dynamic random language, Modern VIN decode, Preview & Checkout validation', async ({ languageModule }, testInfo) => {
    const locale = await test.step('Select random language via Switcher', () => languageModule.selectRandomLanguage());
    const vin = await test.step(`Decode Modern VIN in ${locale.code.toUpperCase()}`, () => languageModule.decodeModernVinInActiveLocale(locale));
    await test.step('Validate Preview localization & attach JSON', () => languageModule.verifyAndRecordPreviewLocalized(testInfo, vin, locale));
    const { usedEmail } = await test.step('Navigate Preview -> Checkout via Access CTA', () => languageModule.proceedToCheckout());
    await test.step('Validate Checkout localization & attach JSON', () => languageModule.verifyAndRecordCheckoutLocalized(testInfo, vin, locale, usedEmail));
  });

  test('TC-09: Short Invalid VIN (< 5 chars A-Z / 1-9 via Direct URL) - Error banner & disabled checkout guard', async ({ vinDecodeModule, shortVinHandler }, testInfo) => {
    const vin = VinGenerator.shortInvalid();
    await test.step(`Open Preview directly with short VIN (${vin})`, () => vinDecodeModule.decodeDirectly(vin));
    await test.step('Validate short VIN rejection, disabled CTA & attach proof', () => shortVinHandler.verifyAndRecordProof(testInfo, vin));
  });

  test('TC-10: Add to Garage (Signup & Login) - Auto-navigation to CDMA My Garage with persisted vehicles', async ({ garageModule }, testInfo) => {
    const signupCtx = await test.step('Signup via Add to Garage & verify default CDMA auto-navigation', () => garageModule.addVehicleViaSignupAndVerifyCdma());
    const loginResult = await test.step('Login via Add to Garage & verify both vehicles in CDMA', () => garageModule.addVehicleViaLoginAndVerifyCdma(signupCtx));
    await test.step('Capture CDMA screenshot, attach Garage API proof & close browser', () => garageModule.recordGarageCdmaProof(testInfo, signupCtx.result, loginResult));
  });
});
