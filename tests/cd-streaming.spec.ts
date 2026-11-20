import { test } from '../src/fixtures';
import { VinGenerator } from '../src/data/VinGenerator';
import { CLARITY_TARGET } from '../src/config/env';
import { pickRegion } from '../src/data/RegionalPool';

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
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
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
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
    const signupCtx = await test.step('Signup via Add to Garage & verify default CDMA auto-navigation', () => garageModule.addVehicleViaSignupAndVerifyCdma());
    const loginResult = await test.step('Login via Add to Garage & verify both vehicles in CDMA', () => garageModule.addVehicleViaLoginAndVerifyCdma(signupCtx));
    await test.step('Capture CDMA screenshot, attach Garage API proof & close browser', () => garageModule.recordGarageCdmaProof(testInfo, signupCtx.result, loginResult));
  });

  test('TC-11: Upsell GIF & Site Settings Alignment - Modern vs Classic across VHR & Sticker', async ({ siteSettingsModule, upsellModule, evidenceModule }, testInfo) => {
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
    const siteSettings = await test.step('Resolve live site_settings upsell copy keys', () => siteSettingsModule.resolveSiteSettings());
    const matrix = await test.step('Verify Classic vs Modern upsell GIFs, text alignment & toggle sync', () => upsellModule.verifyModernVsClassicMatrix(siteSettings));
    await test.step('Attach Upsell GIF & site_settings JSON telemetry', () => evidenceModule.recordUpsellMatrixProof(testInfo, matrix));
  });

  test('TC-12: Plan Selection, Upsell Toggle & Checkout Price Sync (Currency-Agnostic)', async ({ planSelectionModule, checkoutPriceSyncModule, evidenceModule }, testInfo) => {
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
    const selection = await test.step('Select non-default plan & enable upsell on Preview', () => planSelectionModule.selectPlanAndEnableUpsell('vhr'));
    const checkoutSync = await test.step('Verify separate Checkout Order Summary & Pay CTA price sync', () => checkoutPriceSyncModule.proceedAndVerifyPriceSync(selection));
    await test.step('Attach Plan & Checkout Price Sync JSON telemetry', () => evidenceModule.recordPlanCheckoutPriceSyncProof(testInfo, selection, checkoutSync));
  });

  test('TC-13: Revisit Banner - Modern type sync & Classic updated YMMT in new session', async ({ revisitBannerModule, evidenceModule }, testInfo) => {
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
    const modern = await test.step('Modern VIN decode -> Home Revisit Banner -> Grab CTA -> Preview', () => revisitBannerModule.verifyModernRevisitBanner());
    const classic = await test.step('New session Classic VIN -> Edit YMMT -> Home Revisit Banner -> Grab CTA -> Preview', () => revisitBannerModule.verifyClassicEditYmmtRevisitBanner());
    await test.step('Attach Revisit Banner JSON telemetry', () => evidenceModule.recordRevisitBannerProof(testInfo, modern, classic));
  });

  test('TC-14: Plans "Save %" Tag Logic - Dynamic prices, currency & compounded Save % (Without vs. With Coupon)', async ({ plansSaveTagModule, evidenceModule }, testInfo) => {
    test.slow(); // live decode & multi-session flows: native 3x timeout when the site is slow
    const result = await test.step('Verify dynamic Save % tags, prices & CTA sync (Without vs. With Coupon across VHR & Sticker)', () =>
      plansSaveTagModule.verifyPlansSaveTagMatrix()
    );
    await test.step('Attach Plans Save Tag JSON telemetry', () =>
      evidenceModule.recordPlansSaveTagProof(testInfo, result)
    );
  });

  test('TC-15: Preview Email Cache - Same-session prefill, new-session validation & logged-in autofill with direct Checkout', async ({ emailCacheModule, evidenceModule }, testInfo) => {
    test.slow();
    const sameSession = await test.step('Same session: email cached & prefilled on back, reload & new VIN -> direct Checkout', () => emailCacheModule.verifySameSessionPrefill());
    const newSession = await test.step('New session: no prefill, empty & invalid email blocked, valid email -> Checkout', () => emailCacheModule.verifyNewSessionValidation());
    const loggedIn = await test.step('Logged-in: account email auto-filled -> direct Checkout', () => emailCacheModule.verifyLoggedInAutofill());
    await test.step('Attach Email Cache JSON telemetry', () => evidenceModule.recordEmailCacheProof(testInfo, [sameSession, newSession, loggedIn]));
  });

  test('TC-16: Referrer & UTM Cookies - utm_details (UTM landing) vs referrer (Google only)', async ({ trackingCookieModule, evidenceModule }, testInfo) => {
    const utm = await test.step('Preview with UTMs from Google: utm_details set, referrer cookie suppressed', () => trackingCookieModule.verifyUtmCookie());
    const referrer = await test.step('Base URL from Google (no UTMs): referrer cookie set, no utm_details', () => trackingCookieModule.verifyReferrerCookie());
    await test.step('Attach tracking cookie JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Tracking-Cookies-Proof', { utm, referrer }));
  });

  test('TC-17: Dual Coupon - Home offer=get20, then Preview exit-intent banner still triggers', async ({ dualCouponModule, evidenceModule }, testInfo) => {
    test.slow();
    const result = await test.step('Apply get20 on Homepage, decode VIN, trigger exit-intent banner on Preview', () => dualCouponModule.verifyExitIntentWithHomeCoupon('get20'));
    await test.step('Attach dual coupon JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Dual-Coupon-Proof', result));
  });

  test('TC-18: Microsoft Clarity - tag, cookies & beacons active Home -> Preview -> Checkout (Dev)', async ({ clarityModule, evidenceModule }, testInfo) => {
    test.slow();
    const journey = await test.step(`Clarity ${CLARITY_TARGET.projectId} across Home -> Preview -> Checkout`, () => clarityModule.verifyJourney(CLARITY_TARGET));
    await test.step('Attach Clarity JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Clarity-Proof', journey));
  });

  test('TC-19: Regional Currency - inject geo cookies, decode to Preview, match currency sign & backend prices (random region)', async ({ regionalPreviewCurrencyModule, evidenceModule }, testInfo) => {
    test.slow();
    const region = pickRegion();
    const result = await test.step(`Simulate ${region.name} (${region.country}), decode a VIN and verify ${region.currency} on Preview`, () => regionalPreviewCurrencyModule.verifyPreviewCurrency(region));
    await test.step('Attach regional currency JSON telemetry', () => evidenceModule.recordProof(testInfo, 'Regional-Currency-Proof', result));
  });
});
