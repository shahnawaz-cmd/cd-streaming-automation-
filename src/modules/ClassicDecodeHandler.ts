import { expect } from '@playwright/test';
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
   * Evaluates the outcome using an instant race:
   * Resolves the exact millisecond either Condition A OR Condition B finishes!
   */
  async verifyOutcome(timeoutMs = 60_000): Promise<ClassicDecodeOutcome> {
    const classicFallback = this.previewPage.classicFallback;
    const header = this.previewPage.header;

    // Fast initial check if fallback is already mounted
    if (await classicFallback.isVisible()) {
      this.logger.warn("⚠️ Condition B Active: 'Update Your Vehicle Details' manual fallback form displayed.");
      await expect(classicFallback.heading()).toBeVisible();
      return 'MANUAL_YMMT_FALLBACK';
    }

    // Instant Race: resolves as soon as either Condition A or Condition B appears!
    const outcome = await Promise.race([
      header
        .waitForDecodingComplete(timeoutMs)
        .then(() => 'DECODED' as const),
      classicFallback
        .heading()
        .waitFor({ state: 'visible', timeout: timeoutMs })
        .then(() => 'MANUAL_YMMT_FALLBACK' as const),
    ]);

    if (outcome === 'MANUAL_YMMT_FALLBACK') {
      this.logger.warn(
        "⚠️ Condition B Triggered: 'Update Your Vehicle Details' fallback form displayed."
      );
      await expect(classicFallback.heading()).toBeVisible();
      await expect(classicFallback.getRecordsBtn()).toBeVisible();
      return 'MANUAL_YMMT_FALLBACK';
    }

    this.logger.pass('✅ Condition A Succeeded: Classic VIN decoded successfully. CTA enabled.');
    return 'DECODED';
  }
}
