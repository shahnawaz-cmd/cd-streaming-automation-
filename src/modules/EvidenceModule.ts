import { Locator, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CdmaGaragePage } from '../pages/cdma/CdmaGaragePage';
import { ModernDecodeOutcome } from './ModernDecodeHandler';
import { ClassicDecodeOutcome } from './ClassicDecodeHandler';
import { LocalizationValidationReport } from './LanguageValidator';
import type { ShortVinValidationResult } from './ShortVinHandler';
import type { GarageFlowResult } from './GarageModule';
import type { UpsellMatrixResult } from './UpsellModule';
import type { PlanAndUpsellSelectionResult } from './PlanSelectionModule';
import type { CheckoutPriceSyncResult } from './CheckoutPriceSyncModule';
import type { ModernRevisitResult, ClassicEditYmmtRevisitResult } from './RevisitBannerModule';
import type { PlansSaveTagMatrixResult, PlansCouponComparisonResult } from './PlansSaveTagModule';
import type { EmailCacheScenarioResult } from './EmailCacheModule';
import { SupportedLocale } from '../data/LocaleDictionary';
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

  /**
   * Captures original decoded specs and YMM immediately upon decode in pure JSON (zero screenshot).
   */
  async recordOriginalSpecsProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    vin: string
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const vehicleTitle = await previewPage.getVehicleTitle();
    const specs = await previewPage.getSpecifications();

    const payload = {
      vin,
      stage: 'ORIGINAL_DECODED',
      url: await previewPage.getUrl(),
      originalYmmTitle: vehicleTitle,
      specifications: specs,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Original-Specs.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Original Decoded specs JSON for VIN: ${vin}`);
  }

  /**
   * Captures modified YMM, updated URL, and Trim verification in pure JSON (zero screenshot).
   */
  async recordModifiedYmmProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    vin: string,
    data: { year: string; make: string; model: string; trim: string }
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    const payload = {
      vin,
      stage: 'MODIFIED_YMMT',
      requirement: '02-Edit-YMM-Trim',
      trimFieldVerified: true,
      updatedYear: data.year,
      updatedMake: data.make,
      updatedModel: data.model,
      updatedTrim: data.trim,
      url: await previewPage.getUrl(),
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Modified-YMMT.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Modified YMMT & URL telemetry for VIN: ${vin}`);
  }

  /**
   * Captures modified specifications & updated URL in pure JSON (zero screenshot).
   */
  async recordModifiedSpecsProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    vin: string,
    specs: any
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const renderedOnUiSpecs = await previewPage.getSpecifications();

    const payload = {
      vin,
      stage: 'MODIFIED_SPECS',
      url: await previewPage.getUrl(),
      submittedSpecifications: specs,
      renderedOnUiSpecifications: renderedOnUiSpecs,
      frontEndVerified: true,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Modified-Specs.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Modified Specs & URL telemetry for VIN: ${vin}`);
  }

  /**
   * Captures localized Preview page validation report & telemetry in pure JSON (zero screenshot).
   */
  async recordLocalizedPreviewProof(
    testInfo: TestInfo,
    vin: string,
    locale: SupportedLocale,
    report: LocalizationValidationReport
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    const payload = {
      vin,
      stage: 'LOCALIZED_PREVIEW',
      selectedLanguage: locale.label,
      languageCode: locale.code,
      htmlLang: report.htmlLang,
      url: report.url,
      urlHasLocaleParam: report.urlHasLocaleParam,
      capturedHeadings: report.capturedHeadings,
      capturedPrimaryCta: report.capturedPrimaryCtaOrButtons,
      matchedExpectedTerms: report.matchedExpectedTerms,
      missingExpectedTerms: report.missingExpectedTerms,
      englishCoreLeaks: report.englishCoreLeaks,
      rawI18nKeysFound: report.rawI18nKeysFound,
      contentSnippet: report.contentSnippet,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Preview-Localized.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Localized Preview telemetry JSON for language: ${locale.label}`);
  }

  /**
   * Captures localized Checkout page validation report & telemetry in pure JSON (zero screenshot).
   */
  async recordLocalizedCheckoutProof(
    testInfo: TestInfo,
    vin: string,
    locale: SupportedLocale,
    usedEmail: string,
    report: LocalizationValidationReport
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    const payload = {
      vin,
      stage: 'LOCALIZED_CHECKOUT',
      selectedLanguage: locale.label,
      languageCode: locale.code,
      usedEmail,
      htmlLang: report.htmlLang,
      checkoutUrl: report.url,
      urlHasLocaleParam: report.urlHasLocaleParam,
      capturedHeadings: report.capturedHeadings,
      capturedButtons: report.capturedPrimaryCtaOrButtons,
      matchedExpectedTerms: report.matchedExpectedTerms,
      missingExpectedTerms: report.missingExpectedTerms,
      englishCoreLeaks: report.englishCoreLeaks,
      rawI18nKeysFound: report.rawI18nKeysFound,
      contentSnippet: report.contentSnippet,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Checkout-Localized.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Localized Checkout telemetry JSON for language: ${locale.label}`);
  }

  /**
   * Captures screenshot and structured JSON telemetry for malformed short VIN (< 5 chars) rejection.
   */
  async recordShortVinErrorProof(
    testInfo: TestInfo,
    previewPage: PreviewPage,
    result: ShortVinValidationResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    await this.captureElement(
      testInfo,
      previewPage.shortVinError.container(),
      `${testPrefix}-Short-VIN-Error`
    );

    const payload = {
      ...result,
      outcome: 'SHORT_VIN_INVALID',
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Short-VIN-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Short VIN Error telemetry JSON for VIN: ${result.vin}`);
  }

  /**
   * Captures CDMA My Garage screenshot and pure JSON telemetry (including Garage API payloads)
   * for Add to Garage Signup & Login auto-navigation into CDMA.
   */
  async recordGarageCdmaProof(
    testInfo: TestInfo,
    cdmaGaragePage: CdmaGaragePage,
    signupResult: GarageFlowResult,
    loginResult: GarageFlowResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);

    const screenshotBuffer = await cdmaGaragePage.getPage().screenshot({ fullPage: true });
    await testInfo.attach(`${testPrefix}-CDMA-My-Garage.png`, {
      body: screenshotBuffer,
      contentType: 'image/png',
    });
    this.logger.info(`📸 Attached CDMA screenshot: ${testPrefix}-CDMA-My-Garage.png`);

    const payload = {
      outcome: 'GARAGE_CDMA_AUTO_NAVIGATED',
      email: signupResult.email,
      signupPhase: signupResult,
      loginPhase: loginResult,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Garage-CDMA-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached CDMA Garage Signup & Login telemetry JSON for: ${signupResult.email}`);
  }

  /**
   * Attaches JSON telemetry for Modern vs Classic Upsell GIFs, site_settings alignment & toggle sync.
   */
  async recordUpsellMatrixProof(
    testInfo: TestInfo,
    result: UpsellMatrixResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const payload = {
      outcome: 'UPSELL_GIF_AND_SITE_SETTINGS_VERIFIED',
      ...result,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Upsell-GIF-SiteSettings-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info('📄 Attached Upsell GIF & site_settings JSON telemetry');
  }

  /**
   * Attaches JSON telemetry for currency-agnostic Plan selection, Upsell toggle & Checkout Price Sync.
   */
  async recordPlanCheckoutPriceSyncProof(
    testInfo: TestInfo,
    selection: PlanAndUpsellSelectionResult,
    checkoutSync: CheckoutPriceSyncResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const payload = {
      outcome: 'PLAN_AND_CHECKOUT_PRICE_SYNC_VERIFIED',
      vin: selection.vin,
      previewType: selection.previewType,
      currencyToken: selection.currencyToken,
      availablePlans: selection.availablePlans,
      selectedPlan: selection.selectedPlan,
      upsell: selection.upsell,
      previewCtaAfterPlan: selection.previewCtaAfterPlan,
      previewCtaAfterUpsell: selection.previewCtaAfterUpsell,
      checkout: checkoutSync,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Plan-Checkout-PriceSync-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(`📄 Attached Plan & Checkout Price Sync JSON telemetry for VIN: ${selection.vin}`);
  }

  /**
   * Attaches JSON telemetry for Modern & Classic Edit-YMMT Revisit Banner flows.
   */
  async recordRevisitBannerProof(
    testInfo: TestInfo,
    modern: ModernRevisitResult,
    classic: ClassicEditYmmtRevisitResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const payload = {
      outcome: 'REVISIT_BANNER_VERIFIED',
      modernFlow: modern,
      classicEditYmmtFlow: classic,
      capturedAt: new Date().toISOString(),
    };

    await testInfo.attach(`${testPrefix}-Revisit-Banner-Proof.json`, {
      body: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
    });
    this.logger.info(
      `📄 Attached Revisit Banner JSON telemetry: Modern(${modern.vin}, ${modern.previewType}) & Classic(${classic.vin})`
    );
  }

  private formatMoney(amount: number, token: string): string {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    if (!token) return formatted;
    return /[A-Za-z]$/.test(token) ? `${token} ${formatted}` : `${token}${formatted}`;
  }

  private formatSaveTag(savePercent: number | null, isSubscription: boolean): string {
    if (isSubscription) return 'Excluded';
    return savePercent === null ? 'No tag' : `Save ${savePercent}%`;
  }

  private summarizePlansSection(section: PlansCouponComparisonResult) {
    const subtitleMaxSave =
      section.baselineSubtitleMaxSave !== null && section.couponSubtitleMaxSave !== null
        ? `${section.baselineSubtitleMaxSave}% -> ${section.couponSubtitleMaxSave}%`
        : section.couponSubtitleMaxSave !== null
          ? `${section.couponSubtitleMaxSave}%`
          : null;

    const currencyNote =
      section.baselineCurrency === section.couponCurrency
        ? section.couponCurrency
        : `${section.baselineCurrency} -> ${section.couponCurrency} (x${section.conversionFactor})`;

    return {
      ...(currencyNote ? { currency: currencyNote } : {}),
      ...(subtitleMaxSave !== null ? { subtitleMaxSave } : {}),
      plans: section.planChecks.map((p) => ({
        plan: p.label,
        withoutCoupon: `${this.formatMoney(p.baselineTotal, section.baselineCurrency)} (${this.formatSaveTag(p.baselineSavePercent, p.isSubscription)})`,
        withCoupon: `${this.formatMoney(p.couponTotal, section.couponCurrency)} (${this.formatSaveTag(p.couponSavePercent, p.isSubscription)})`,
        cta: this.formatMoney(p.ctaSyncedAmount, section.couponCurrency),
      })),
    };
  }

  /**
   * Attaches compact, scannable JSON telemetry for dynamic Plans "Save %" tag & coupon math.
   */
  async recordPlansSaveTagProof(
    testInfo: TestInfo,
    result: PlansSaveTagMatrixResult
  ): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const currency =
      result.vhr.baselineCurrency === result.vhr.couponCurrency
        ? result.vhr.couponCurrency
        : `${result.vhr.baselineCurrency} -> ${result.vhr.couponCurrency} (x${result.vhr.conversionFactor})`;

    const payload = {
      status: 'PASSED',
      vin: result.vin,
      coupon: `${result.offerCode} (${Math.round(result.vhr.effectiveCouponRate * 100)}% off)`,
      currency,
      vhr: this.summarizePlansSection(result.vhr),
      sticker: this.summarizePlansSection(result.sticker),
      capturedAt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload, null, 2);
    await testInfo.attach(`${testPrefix}-Plans-Save-Tag-Proof.json`, {
      body,
      contentType: 'application/json',
    });
    this.logger.info(
      `📄 Attached compact Plans Save Tag JSON telemetry for VIN: ${result.vin} (offer=${result.offerCode})`
    );
  }

  /**
   * Generic compact JSON proof attachment (`<TC-id>-<name>.json`) for lightweight scenarios.
   */
  async recordProof(testInfo: TestInfo, name: string, data: object): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const body = JSON.stringify({ status: 'PASSED', ...data, capturedAt: new Date().toISOString() }, null, 2);
    await testInfo.attach(`${testPrefix}-${name}.json`, { body, contentType: 'application/json' });
    this.logger.info(`📄 Attached ${testPrefix}-${name}.json`);
  }

  /**
   * Attaches compact JSON telemetry for Preview email cache / autofill scenarios.
   */
  async recordEmailCacheProof(testInfo: TestInfo, scenarios: EmailCacheScenarioResult[]): Promise<void> {
    const testPrefix = testInfo.title.slice(0, 5);
    const body = JSON.stringify({ status: 'PASSED', scenarios, capturedAt: new Date().toISOString() }, null, 2);
    await testInfo.attach(`${testPrefix}-Email-Cache-Proof.json`, { body, contentType: 'application/json' });
    this.logger.info(`📄 Attached Email Cache JSON telemetry (${scenarios.map((s) => s.scenario).join(', ')})`);
  }
}
