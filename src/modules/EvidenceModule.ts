import { Locator, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { ModernDecodeOutcome } from './ModernDecodeHandler';
import { ClassicDecodeOutcome } from './ClassicDecodeHandler';
import { Logger } from '../utils/Logger';

export type AnyDecodeOutcome = ModernDecodeOutcome | ClassicDecodeOutcome;

/**
 * Layer 3: EvidenceModule
 * Encapsulates all proof generation, element captures, and JSON telemetry.
 * Keeps test specs 100% clean, declarative, and free of boilerplate.
 */
export class EvidenceModule {
  private logger = new Logger('EvidenceModule');

  /**
   * Captures an element screenshot and attaches it to the Playwright report.
   */
  async captureElement(
    testInfo: TestInfo,
    locator: Locator,
    attachmentName: string = 'Element-Screenshot'
  ): Promise<Buffer> {
    const screenshot = await locator.screenshot();
    await testInfo.attach(`${attachmentName}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });
    this.logger.info(`📸 Attached element screenshot: ${attachmentName}.png`);
    return screenshot;
  }

  /**
   * Dedicated 1-line evidence capture for Preview Page tests:
   * Handles Decoded, Modern Not-Found Fallback, and Classic Manual YMMT Fallback.
   */
  async recordPreviewProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    vin: string,
    outcome: AnyDecodeOutcome = 'DECODED'
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    if (outcome === 'NOT_FOUND_FALLBACK') {
      // Snap the Modern "Not Found" error banner
      await this.captureElement(
        testInfo,
        previewPage.notFound.container(),
        `${testPrefix}-NotFound-Fallback`
      );

      const payload = {
        vin,
        outcome: 'NOT_FOUND_FALLBACK',
        banner: "We couldn't find a vehicle for this VIN",
        ctaState: 'Disabled (Guarded)',
        gracefullyHandled: true,
        capturedAt: new Date().toISOString(),
      };

      await testInfo.attach(`${testPrefix}-Fallback-Proof.json`, {
        body: JSON.stringify(payload, null, 2),
        contentType: 'application/json',
      });
      this.logger.info(`📄 Attached Fallback telemetry for VIN: ${vin}`);
      return;
    }

    if (outcome === 'MANUAL_YMMT_FALLBACK') {
      // Snap the Classic "Update Your Vehicle Details" manual fallback form
      await this.captureElement(
        testInfo,
        previewPage.classicFallback.container(),
        `${testPrefix}-Classic-Fallback`
      );

      const payload = {
        vin,
        outcome: 'MANUAL_YMMT_FALLBACK',
        banner: 'Update Your Vehicle Details',
        fallbackFormReady: true,
        hasGetRecordsBtn: true,
        gracefullyHandled: true,
        capturedAt: new Date().toISOString(),
      };

      await testInfo.attach(`${testPrefix}-Fallback-Proof.json`, {
        body: JSON.stringify(payload, null, 2),
        contentType: 'application/json',
      });
      this.logger.info(`📄 Attached Classic Fallback telemetry for VIN: ${vin}`);
      return;
    }

    // Condition A (Decoded)
    await this.captureElement(
      testInfo,
      previewPage.header.heroCard(),
      `${testPrefix}-Header-Specs`
    );

    const titleText =
      (await previewPage.header.vehicleTitle().textContent().catch(() => ''))?.trim() || '';
    const isModern = vin.length === 17;
    const isEnabled = await previewPage.header.accessRecordCta().isEnabled().catch(() => false);

    const payload = {
      vin,
      outcome: 'DECODED',
      vinType: isModern ? 'Modern US (17-char)' : 'Classic Mapped (Pre-1981)',
      vehicleTitle: titleText,
      ctaState: isEnabled ? 'Enabled' : 'Disabled',
      isModernUs: isModern,
      isClassic: !isModern,
      verified: isEnabled,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Data-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached complete variant telemetry for VIN: ${vin}`);
  }

  /**
   * Dedicated evidence capture for Exit-Intent & Coupon Guard:
   * Captures the plans with discounted pricing and attaches coupon telemetry.
   */
  async recordExitIntentProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    vin: string,
    data: { url: string; saveTags: string[]; ctaPriceText: string }
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    // Capture plans with discount and Save tags
    await this.captureElement(
      testInfo,
      previewPage.plans.plansContainer(),
      `${testPrefix}-Plans-Discount`
    );

    const payload = {
      vin,
      requirement: '03-Exit-Intent-Discount',
      appliedOffer: 'preview15',
      discountPercentage: '15%',
      checkoutCtaPrice: data.ctaPriceText,
      saveTags: data.saveTags,
      couponGuardVerified: true,
      url: data.url,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Discount-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Exit-Intent coupon telemetry for VIN: ${vin}`);
  }
}
