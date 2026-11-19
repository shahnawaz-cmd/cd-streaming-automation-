import { Page, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { LanguageSwitcherComponent } from '../pages/common/LanguageSwitcherComponent';
import { LanguageValidator, LocalizationValidationReport } from './LanguageValidator';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { VinDecodeModule } from './VinDecodeModule';
import { EvidenceModule } from './EvidenceModule';
import { SupportedLocale } from '../data/LocaleDictionary';
import { VinGenerator } from '../data/VinGenerator';
import { Logger } from '../utils/Logger';

/**
 * Layer 3: LanguageModule
 * Orchestrates the full multi-language localization journey:
 * 1. Dynamic random language selection via Header Globe Switcher.
 * 2. Modern VIN decoding in the active locale with automatic retry on Not-Found fallback.
 * 3. Strict Preview localization verification.
 * 4. Preview -> Checkout transition via Package Access CTA & delivery email.
 * 5. Strict Checkout localization verification.
 */
export class LanguageModule {
  private logger = new Logger('LanguageModule');
  readonly switcher: LanguageSwitcherComponent;
  readonly validator: LanguageValidator;

  constructor(
    private page: Page,
    previewPage: PreviewPage,
    checkoutPage: CheckoutPage,
    private previewCheckoutModule: PreviewCheckoutModule,
    private vinDecodeModule: VinDecodeModule,
    private evidenceModule: EvidenceModule
  ) {
    this.switcher = new LanguageSwitcherComponent(page);
    this.validator = new LanguageValidator(page, checkoutPage);
  }

  /**
   * Selects a random non-active language dynamically from the live DOM menu.
   */
  async selectRandomLanguage(): Promise<SupportedLocale> {
    return this.switcher.selectRandomLanguage();
  }

  /**
   * Pulls a fresh Modern 17-char VIN, submits on the localized homepage,
   * and verifies streaming decode completes cleanly (retrying up to 3 VINs on Not-Found).
   */
  async decodeModernVinInActiveLocale(locale: SupportedLocale): Promise<string> {
    const maxAttempts = 3;
    let activeVin = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      activeVin = await VinGenerator.modernFromMongo();
      await this.vinDecodeModule.submitVinOnCurrentPage(activeVin);
      const outcome = await this.previewCheckoutModule.waitForLocalizedDecodeOutcome();

      if (outcome === 'DECODED') {
        this.logger.pass(`Decoded Modern VIN ${activeVin} cleanly in locale ${locale.code.toUpperCase()}`);
        return activeVin;
      }

      this.logger.warn(
        `Attempt ${attempt}/${maxAttempts}: Modern VIN ${activeVin} returned NOT_FOUND in ${locale.code.toUpperCase()}; retrying on localized homepage...`
      );
      if (attempt < maxAttempts) {
        const localeHome = locale.code === 'en' ? '/' : `/${locale.code}`;
        await this.page.goto(localeHome, { waitUntil: 'networkidle' });
      }
    }

    throw new Error(
      `[LanguageModule] Failed to decode a Modern VIN in ${maxAttempts} attempts under locale "${locale.code}"`
    );
  }

  /**
   * Validates the Preview page content is strictly localized to the selected language.
   */
  async verifyPreviewLocalized(locale: SupportedLocale): Promise<LocalizationValidationReport> {
    return this.validator.validatePreview(locale);
  }

  /**
   * Validates Preview localization and attaches pure JSON telemetry.
   */
  async verifyAndRecordPreviewLocalized(
    testInfo: TestInfo,
    vin: string,
    locale: SupportedLocale
  ): Promise<LocalizationValidationReport> {
    const report = await this.verifyPreviewLocalized(locale);
    await this.evidenceModule.recordLocalizedPreviewProof(testInfo, vin, locale, report);
    return report;
  }

  /**
   * Navigates from Preview to Checkout via Access Record CTA & delivery email.
   */
  async proceedToCheckout(email?: string): Promise<{ usedEmail: string; checkoutUrl: string }> {
    return this.previewCheckoutModule.proceedToCheckoutViaAccessCta(email);
  }

  /**
   * Validates the Checkout page content is strictly localized to the selected language.
   */
  async verifyCheckoutLocalized(locale: SupportedLocale): Promise<LocalizationValidationReport> {
    return this.validator.validateCheckout(locale);
  }

  /**
   * Validates Checkout localization and attaches pure JSON telemetry.
   */
  async verifyAndRecordCheckoutLocalized(
    testInfo: TestInfo,
    vin: string,
    locale: SupportedLocale,
    usedEmail: string
  ): Promise<LocalizationValidationReport> {
    const report = await this.verifyCheckoutLocalized(locale);
    await this.evidenceModule.recordLocalizedCheckoutProof(testInfo, vin, locale, usedEmail, report);
    return report;
  }
}
