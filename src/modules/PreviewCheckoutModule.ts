import { expect, Page } from '@playwright/test';
import { PreviewPage, PreviewType } from '../pages/preview/PreviewPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { EmailGenerator } from '../data/EmailGenerator';
import { VinGenerator } from '../data/VinGenerator';
import { Logger } from '../utils/Logger';

export type LocalizedDecodeOutcome = 'DECODED' | 'NOT_FOUND';

/**
 * Layer 3: PreviewCheckoutModule
 * Language-agnostic module handling:
 * 1. Streaming decode completion vs Not-Found fallback via structural DOM locators.
 * 2. Preview -> Checkout transition via Package Access CTA & delivery email submission.
 */
export class PreviewCheckoutModule {
  private logger = new Logger('PreviewCheckoutModule');

  constructor(
    private page: Page,
    private previewPage: PreviewPage,
    private checkoutPage: CheckoutPage
  ) {}

  /**
   * Races structural DOM signals for Decoded Package CTA becoming enabled vs Not-Found search input.
   */
  async waitForLocalizedDecodeOutcome(): Promise<LocalizedDecodeOutcome> {
    const decodedCta = this.previewPage.header
      .packageSection()
      .locator('button[aria-busy]:not([disabled])')
      .first();
    const notFoundSearchInput = this.page
      .locator('main input[type="text"]')
      .or(this.previewPage.notFound.heading())
      .first();

    const outcome = await Promise.race([
      decodedCta.waitFor({ state: 'visible' }).then(() => 'DECODED' as const),
      notFoundSearchInput.waitFor({ state: 'visible' }).then(() => 'NOT_FOUND' as const),
    ]);

    this.logger.info(`Localized decode outcome resolved: ${outcome}`);
    return outcome;
  }

  /**
   * Shared retry loop: pulls a fresh MongoDB Modern VIN, opens it via `open`, and retries on NOT_FOUND.
   * `open(vin, attempt)` decides how the VIN is loaded (direct URL, homepage form, localized page...).
   */
  async decodeFreshModernVin(
    open: (vin: string, attempt: number) => Promise<void>,
    maxAttempts = 4
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const vin = await VinGenerator.modernFromMongo();
      await open(vin, attempt);
      if ((await this.waitForLocalizedDecodeOutcome()) === 'DECODED') {
        this.logger.pass(`Decoded Modern VIN ${vin} (attempt ${attempt})`);
        return vin;
      }
      this.logger.warn(`Attempt ${attempt}/${maxAttempts}: Modern VIN ${vin} returned NOT_FOUND, retrying...`);
    }
    throw new Error(`[PreviewCheckoutModule] Failed to decode a Modern VIN after ${maxAttempts} attempts`);
  }

  /**
   * Convenience: decodes a fresh Modern VIN by opening Preview directly with the given type.
   */
  openFreshModernVin(previewType: PreviewType = 'vhr', maxAttempts = 4): Promise<string> {
    return this.decodeFreshModernVin((vin) => this.previewPage.openDirectly(vin, previewType), maxAttempts);
  }

  /**
   * Clicks the Package Access CTA, reveals and fills delivery email if collapsed,
   * then submits via the Access CTA to land on Checkout.
   */
  async proceedToCheckoutViaAccessCta(
    email?: string
  ): Promise<{ usedEmail: string; checkoutUrl: string }> {
    const targetEmail = email || EmailGenerator.generate();
    const pkgCta = this.previewPage.header.packageAccessCta();
    const emailInput = this.previewPage.header.deliveryEmailInput();
    const accordionBtn = this.previewPage.header.deliveryAccordionBtn();

    await expect(pkgCta).toBeVisible();
    await expect(pkgCta).toBeEnabled();

    if (!(await emailInput.isVisible())) {
      await pkgCta.click();
      if (!(await emailInput.isVisible())) {
        const expanded = await accordionBtn.getAttribute('aria-expanded').catch(() => null);
        if (expanded === 'false') {
          await accordionBtn.click();
        }
      }
      await expect(emailInput).toBeVisible();
    }

    await emailInput.fill(targetEmail);
    await pkgCta.click();

    await this.checkoutPage.verifyLandedOnCheckout();
    const checkoutUrl = this.page.url();
    this.logger.pass(`Navigated Preview -> Checkout (${targetEmail}): ${checkoutUrl}`);

    return { usedEmail: targetEmail, checkoutUrl };
  }
}
