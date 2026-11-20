import { expect } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { Logger } from '../utils/Logger';

export type ModernDecodeOutcome = 'DECODED' | 'NOT_FOUND_FALLBACK';

/**
 * Layer 3: ModernDecodeHandler
 * Encapsulates instant race-condition evaluation for Modern 17-char VINs:
 * - Condition A (Success): Decodes vehicle details & asserts CTA transitions to Enabled.
 * - Condition B (Fallback): Detects 'Not Found' banner instantly (zero 60s wait) & asserts CTA remains Disabled.
 */
export class ModernDecodeHandler {
  private logger = new Logger('ModernDecodeHandler');

  constructor(private previewPage: PreviewPage) {}

  /**
   * Evaluates the outcome using Playwright's native .or() race:
   * Resolves the exact millisecond either Condition A OR Condition B finishes!
   */
  async verifyOutcome(timeoutMs?: number): Promise<ModernDecodeOutcome> {
    const notFound = this.previewPage.notFound;
    const header = this.previewPage.header;

    // Fast initial check if fallback is already mounted
    if (await notFound.isVisible()) {
      this.logger.warn("⚠️ Condition B Active: 'We couldn't find a vehicle for this VIN' banner displayed.");
      await expect(notFound.heading()).toBeVisible();
      const cta = await header.getHealedCta();
      await expect(cta).toBeDisabled();
      return 'NOT_FOUND_FALLBACK';
    }

    const waitOpts =
      timeoutMs !== undefined
        ? { state: 'visible' as const, timeout: timeoutMs }
        : { state: 'visible' as const };

    await header.enabledAccessRecordCta().or(notFound.heading()).first().waitFor(waitOpts);

    if (await notFound.isVisible()) {
      this.logger.warn(
        "⚠️ Condition B Triggered: 'We couldn't find a vehicle for this VIN' banner displayed. CTA remains disabled (Fallback mode)."
      );
      await expect(notFound.heading()).toBeVisible();
      const cta = await header.getHealedCta();
      await expect(cta).toBeDisabled();
      return 'NOT_FOUND_FALLBACK';
    }

    const cta = await header.getHealedCta();
    await expect(cta).toBeEnabled();
    this.logger.pass('✅ Condition A Succeeded: VIN was accepted/decoded by server without error. CTA is enabled (Same as Case 1 decoded flow).');
    return 'DECODED';
  }
}
