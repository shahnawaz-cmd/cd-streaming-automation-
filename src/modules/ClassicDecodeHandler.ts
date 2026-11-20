import { expect, test } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { Logger } from '../utils/Logger';

export type ClassicDecodeOutcome = 'DECODED' | 'MANUAL_YMMT_FALLBACK';

/**
 * Layer 3: ClassicDecodeHandler
 * Encapsulates instant race-condition evaluation for Classic Pre-1981 / Short VINs:
 * - Condition A (Success): Decodes vehicle details & asserts CTA transitions to Enabled.
 * - Condition B (Fallback): Detects 'Update Your Vehicle Details' manual YMMT selection form
 *   (e.g., API timeout / Cloudflare delay / unmapped VIN) & asserts fallback form elements are ready.
 */
export class ClassicDecodeHandler {
  private logger = new Logger('ClassicDecodeHandler');

  constructor(private previewPage: PreviewPage) {}

  /**
   * Evaluates the outcome using Playwright's native .or() race:
   * Resolves the exact millisecond either Condition A OR Condition B finishes!
   */
  async verifyOutcome(timeoutMs?: number): Promise<ClassicDecodeOutcome> {
    const classicFallback = this.previewPage.classicFallback;
    const header = this.previewPage.header;

    // Fast initial check if fallback is already mounted
    if (await classicFallback.isVisible()) {
      this.logger.warn("⚠️ Condition B Active: 'Update Your Vehicle Details' manual fallback form displayed.");
      await expect(classicFallback.heading()).toBeVisible();
      return 'MANUAL_YMMT_FALLBACK';
    }

    const waitOpts =
      timeoutMs !== undefined
        ? { state: 'visible' as const, timeout: timeoutMs }
        : { state: 'visible' as const };

    await header.enabledAccessRecordCta().or(classicFallback.heading()).first().waitFor(waitOpts);

    if (await classicFallback.isVisible()) {
      this.logger.warn(
        "⚠️ Condition B Triggered: 'Update Your Vehicle Details' fallback form displayed (Manual YMMT mode)."
      );
      await expect(classicFallback.heading()).toBeVisible();
      await expect(classicFallback.getRecordsBtn()).toBeVisible();
      return 'MANUAL_YMMT_FALLBACK';
    }

    const cta = await header.getHealedCta();
    await expect(cta).toBeEnabled();
    this.logger.pass('✅ Condition A Succeeded: Classic VIN was accepted/decoded by server without error. CTA is enabled (Same as Case 2 decoded flow).');
    return 'DECODED';
  }

  /**
   * Classic Failover Graceful Skip Guard:
   * Whenever TC-05 failover ('Update Your Vehicle Details') triggers instead of a full decode,
   * gracefully skips the test so downstream edit/upsell/revisit assertions do not fail falsely.
   */
  async requireDecodedOrSkip(vin: string, timeoutMs?: number): Promise<void> {
    const outcome = await this.verifyOutcome(timeoutMs);
    if (outcome === 'MANUAL_YMMT_FALLBACK' || (await this.previewPage.classicFallback.isVisible())) {
      const reason = `Classic VIN "${vin}" not decoded (TC-05 Classic Failover: 'Update Your Vehicle Details')`;
      this.logger.warn(`⏭️ ${reason} — gracefully skipping test.`);
      test.skip(true, reason);
    }
  }
}
