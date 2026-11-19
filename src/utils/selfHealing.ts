import { Locator, Page } from '@playwright/test';

/**
 * Self-healing locator helper: tries an ordered list of fallback selectors
 * and returns the first visible Locator.
 */
export async function findFirstVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 15_000
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (let i = 0; i < selectors.length; i++) {
      const locator = page.locator(selectors[i]).first();
      if (await locator.isVisible().catch(() => false)) {
        if (i > 0) {
          console.warn(`[Self-Healing] Primary selector failed; healed using fallback [${i}]: ${selectors[i]}`);
        }
        return locator;
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`[Self-Healing] None of the selectors became visible: ${selectors.join(' | ')}`);
}
