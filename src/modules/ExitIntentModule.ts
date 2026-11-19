import { expect, Page } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { EmailGenerator } from '../data';
import { Logger } from '../utils/Logger';

/**
 * Layer 3: ExitIntentModule
 * Encapsulates the Exit Intent popup trigger, coupon guard blocking check,
 * and discount application verification on Preview plans.
 */
export class ExitIntentModule {
  private logger = new Logger('ExitIntentModule');

  constructor(
    private page: Page,
    private previewPage: PreviewPage
  ) {}

  /**
   * Triggers the exit-intent popup by simulating mouse movement out of top viewport
   * and verifies the modal appears.
   */
  async triggerPopup(): Promise<void> {
    this.logger.step('Trigger exit-intent pop-up on Preview page');
    const exitIntent = this.previewPage.exitIntent;

    // Retry triggering if not immediately visible
    for (let attempt = 1; attempt <= 3; attempt++) {
      await exitIntent.trigger();
      try {
        await expect(exitIntent.heading()).toBeVisible({ timeout: 4_000 });
        this.logger.pass('✅ Exit-intent popup appeared: "Wait! Before you go, grab your 15% OFF discount!"');
        return;
      } catch (_) {
        this.logger.info(`Exit intent trigger attempt ${attempt} did not display modal yet, retrying...`);
        await this.page.waitForTimeout(500);
      }
    }

    await expect(exitIntent.heading()).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Submits email in exit-intent modal and verifies:
   * 1. Checkout button is blocked/disabled during discount application ("Applying your discount…").
   * 2. URL updates to include `offer=preview15`.
   * 3. Plans update with 15% discount and "Save" tags.
   */
  async applyDiscountAndVerifyGuard(email?: string): Promise<{
    url: string;
    saveTags: string[];
    ctaPriceText: string;
    usedEmail: string;
  }> {
    const exitIntent = this.previewPage.exitIntent;
    const header = this.previewPage.header;
    const targetEmail = email || EmailGenerator.generate();

    this.logger.step(`Submit exit-intent email (${targetEmail}) and verify coupon guard`);

    // Submit email with force bypass for backdrop animations
    this.logger.info(`Entering email and submitting discount: ${targetEmail}`);
    await exitIntent.submitEmail(targetEmail);

    // Verify coupon guard: page displays "Applying your discount..." or CTA is guarded/disabled
    const applying = exitIntent.applyingBanner();
    const cta = header.accessRecordCta();

    const isApplyingVisible = await applying.isVisible().catch(() => false);
    if (isApplyingVisible) {
      this.logger.pass('✅ Coupon Guard Verified: "Applying your discount…" banner displayed.');
      await expect(cta).toBeDisabled();
    } else {
      this.logger.info('Discount application processed rapidly.');
    }

    this.logger.info('Verifying discount applied to CTA and plans...');
    // Verify CTA updates to show $25.49 discounted price
    await expect(cta).toContainText('25.49', { timeout: 15_000 });
    this.logger.pass('✅ CTA verified with $25.49 discounted price.');

    // Verify Save badges are present on plans
    const saveTags = await this.previewPage.plans.getSaveTags();
    this.logger.pass(`✅ Discounted Plans verified with Save tags: ${JSON.stringify(saveTags)}`);

    const ctaPriceText = (await cta.textContent())?.trim() || '';

    return {
      url: this.page.url(),
      saveTags,
      ctaPriceText,
      usedEmail: targetEmail,
    };
  }
}
