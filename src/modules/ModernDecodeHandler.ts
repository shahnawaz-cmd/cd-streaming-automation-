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
   * Evaluates the outcome using an instant race:
   * Resolves the exact millisecond either Condition A OR Condition B finishes!
   */
  async verifyOutcome(timeoutMs = 60_000): Promise<ModernDecodeOutcome> {
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

    // Instant Race: resolves as soon as either Condition A or Condition B appears!
    const outcome = await Promise.race([
      header
        .waitForDecodingComplete(timeoutMs)
        .then(() => 'DECODED' as const),
      notFound
        .heading()
        .waitFor({ state: 'visible', timeout: timeoutMs })
        .then(() => 'NOT_FOUND_FALLBACK' as const),
    ]);

    if (outcome === 'NOT_FOUND_FALLBACK') {
      this.logger.warn(
        "⚠️ Condition B Triggered: 'We couldn't find a vehicle for this VIN' banner displayed."
      );
      await expect(notFound.heading()).toBeVisible();
      const cta = await header.getHealedCta();
      await expect(cta).toBeDisabled();
      return 'NOT_FOUND_FALLBACK';
    }

    this.logger.pass('✅ Condition A Succeeded: Modern VIN decoded successfully. CTA enabled.');
    return 'DECODED';
  }
}
