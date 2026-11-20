import { Page, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { LanguageSwitcherComponent } from '../pages/common/LanguageSwitcherComponent';
import { LanguageValidator, LocalizationValidationReport } from './LanguageValidator';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { VinDecodeModule } from './VinDecodeModule';
import { EvidenceModule } from './EvidenceModule';
import { SupportedLocale } from '../data/LocaleDictionary';
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
    const localeHome = locale.code === 'en' ? '/' : `/${locale.code}`;
    const vin = await this.previewCheckoutModule.decodeFreshModernVin(async (candidate, attempt) => {
      // Retries restart from the localized homepage (first attempt submits on the page already open)
      if (attempt > 1) await this.page.goto(localeHome, { waitUntil: 'networkidle' });
      await this.vinDecodeModule.submitVinOnCurrentPage(candidate);
    }, 3);
    this.logger.pass(`Decoded Modern VIN ${vin} cleanly in locale ${locale.code.toUpperCase()}`);
    return vin;
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
