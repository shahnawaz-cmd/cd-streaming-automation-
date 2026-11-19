import { expect, Page } from '@playwright/test';
import { ENGLISH_CORE_LEAK_MARKERS, SupportedLocale } from '../data/LocaleDictionary';
import { CheckoutPage } from '../pages/CheckoutPage';
import { Logger } from '../utils/Logger';

export interface LocalizationValidationReport {
  stage: 'PREVIEW' | 'CHECKOUT';
  expectedLocale: string;
  htmlLang: string | null;
  url: string;
  urlHasLocaleParam: boolean;
  matchedExpectedTerms: string[];
  missingExpectedTerms: string[];
  englishCoreLeaks: string[];
  rawI18nKeysFound: boolean;
  capturedHeadings: string[];
  capturedPrimaryCtaOrButtons: string[];
  contentSnippet: string;
}

const RAW_I18N_KEY_PATTERN = /\{\{[^}]+\}\}|t\(["'][^"']+["']\)|\[MISSING_[A-Z_]+\]/;

/**
 * Layer 3/5: LanguageValidator
 * Strict localization validator enforcing real assertions on <html lang>, URL locale parameter,
 * translated CTA and headings, absence of English core leaks, and absence of raw i18n keys.
 */
export class LanguageValidator {
  private logger = new Logger('LanguageValidator');

  constructor(
    private page: Page,
    private checkoutPage: CheckoutPage
  ) {}

  /**
   * Asserts no raw unrendered i18n template placeholders exist in rendered page text.
   */
  assertNoRawI18nKeys(text: string): void {
    const hasRawKey = RAW_I18N_KEY_PATTERN.test(text);
    expect(
      hasRawKey,
      `Page content contains raw unrendered i18n placeholders: ${text.slice(0, 160)}`
    ).toBeFalsy();
  }

  /**
   * Strictly validates Preview page translations and captures structured telemetry.
   */
  async validatePreview(locale: SupportedLocale): Promise<LocalizationValidationReport> {
    await expect(this.page.locator('html')).toHaveAttribute('lang', locale.code);

    const localeUrlRegex = new RegExp(`[?&]locale=${locale.code}(?:&|$)`);
    if (locale.code !== 'en') {
      await expect(this.page).toHaveURL(localeUrlRegex);
    }

    const domData = await this.page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const h2s = Array.from(document.querySelectorAll('h2'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const pkgSec = document.querySelector('section:has(input[type="email"])');
      const primaryCta =
        pkgSec?.querySelector('button[aria-busy]')?.textContent?.trim() || '';
      const mainEl = (document.querySelector('main') || document.body) as HTMLElement;
      return {
        url: location.href,
        htmlLang: document.documentElement.getAttribute('lang'),
        headings: [h1, ...h2s].filter(Boolean),
        primaryCta,
        bodyText: (mainEl?.innerText || '').trim(),
      };
    });

    expect(
      domData.primaryCta,
      `Primary Access CTA "${domData.primaryCta}" did not match ${locale.name} pattern ${locale.previewCtaPattern}`
    ).toMatch(locale.previewCtaPattern);

    const searchCorpus = `${domData.headings.join('\n')}\n${domData.bodyText}`.toLowerCase();
    const matchedExpectedTerms = locale.previewRequiredHeadings.filter((term) =>
      searchCorpus.includes(term.toLowerCase())
    );
    const missingExpectedTerms = locale.previewRequiredHeadings.filter(
      (term) => !searchCorpus.includes(term.toLowerCase())
    );

    expect(
      matchedExpectedTerms.length,
      `Expected >= 3 translated Preview headings for ${locale.name}; matched=[${matchedExpectedTerms.join(', ')}], capturedHeadings=[${domData.headings.join(' | ')}]`
    ).toBeGreaterThanOrEqual(3);

    const headingAndCtaCorpus = `${domData.headings.join('\n')}\n${domData.primaryCta}`.toLowerCase();
    const englishCoreLeaks =
      locale.code !== 'en'
        ? ENGLISH_CORE_LEAK_MARKERS.preview.filter((marker) =>
            headingAndCtaCorpus.includes(marker.toLowerCase())
          )
        : [];

    expect(
      englishCoreLeaks,
      `Detected untranslated English core UI markers on ${locale.name} Preview page: [${englishCoreLeaks.join(', ')}]`
    ).toEqual([]);

    const rawI18nKeysFound = RAW_I18N_KEY_PATTERN.test(domData.bodyText);
    this.assertNoRawI18nKeys(domData.bodyText);

    const report: LocalizationValidationReport = {
      stage: 'PREVIEW',
      expectedLocale: locale.code,
      htmlLang: domData.htmlLang,
      url: domData.url,
      urlHasLocaleParam: locale.code === 'en' ? true : localeUrlRegex.test(domData.url),
      matchedExpectedTerms,
      missingExpectedTerms,
      englishCoreLeaks,
      rawI18nKeysFound,
      capturedHeadings: domData.headings,
      capturedPrimaryCtaOrButtons: domData.primaryCta ? [domData.primaryCta] : [],
      contentSnippet: domData.bodyText.slice(0, 600),
    };

    this.logger.pass(
      `Preview localized (${locale.code.toUpperCase()}): matched=${matchedExpectedTerms.length}/${locale.previewRequiredHeadings.length} [${matchedExpectedTerms.join(', ')}], CTA="${domData.primaryCta}"`
    );

    return report;
  }

  /**
   * Strictly validates Checkout page translations and captures structured telemetry.
   */
  async validateCheckout(locale: SupportedLocale): Promise<LocalizationValidationReport> {
    await expect(this.page).toHaveURL(/\/checkout/);
    await expect(this.page.locator('html')).toHaveAttribute('lang', locale.code);

    const localeUrlRegex = new RegExp(`[?&]locale=${locale.code}(?:&|$)`);
    if (locale.code !== 'en') {
      await expect(this.page).toHaveURL(localeUrlRegex);
    }

    const domData = await this.checkoutPage.captureStructuredContent();
    const fullLowerText = `${domData.headings.join('\n')}\n${domData.buttons.join('\n')}\n${domData.bodyText}`.toLowerCase();

    const matchedExpectedTerms = locale.checkoutRequiredTerms.filter((term) =>
      fullLowerText.includes(term.toLowerCase())
    );
    const missingExpectedTerms = locale.checkoutRequiredTerms.filter(
      (term) => !fullLowerText.includes(term.toLowerCase())
    );

    expect(
      matchedExpectedTerms.length,
      `Expected >= 4 translated Checkout terms for ${locale.name}; matched=[${matchedExpectedTerms.join(', ')}], headings=[${domData.headings.join(' | ')}], buttons=[${domData.buttons.join(' | ')}]`
    ).toBeGreaterThanOrEqual(4);

    const englishCoreLeaks =
      locale.code !== 'en'
        ? ENGLISH_CORE_LEAK_MARKERS.checkout.filter((marker) =>
            fullLowerText.includes(marker.toLowerCase())
          )
        : [];

    expect(
      englishCoreLeaks,
      `Detected untranslated English core UI markers on ${locale.name} Checkout page: [${englishCoreLeaks.join(', ')}]`
    ).toEqual([]);

    const rawI18nKeysFound = RAW_I18N_KEY_PATTERN.test(domData.bodyText);
    this.assertNoRawI18nKeys(domData.bodyText);

    const report: LocalizationValidationReport = {
      stage: 'CHECKOUT',
      expectedLocale: locale.code,
      htmlLang: domData.htmlLang,
      url: domData.url,
      urlHasLocaleParam: locale.code === 'en' ? true : localeUrlRegex.test(domData.url),
      matchedExpectedTerms,
      missingExpectedTerms,
      englishCoreLeaks,
      rawI18nKeysFound,
      capturedHeadings: domData.headings,
      capturedPrimaryCtaOrButtons: domData.buttons,
      contentSnippet: domData.bodyText.slice(0, 800),
    };

    this.logger.pass(
      `Checkout localized (${locale.code.toUpperCase()}): matched=${matchedExpectedTerms.length}/${locale.checkoutRequiredTerms.length} [${matchedExpectedTerms.join(', ')}]`
    );

    return report;
  }
}
