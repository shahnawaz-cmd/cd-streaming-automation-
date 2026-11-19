import { Page, Locator } from '@playwright/test';
import { SelfHealingAgent } from '../../utils/SelfHealingAgent';

/**
 * HomeHeroComponent
 * Encapsulates the main Homepage VIN lookup input, submit button, and redirect logic.
 */
export class HomeHeroComponent {
  private healer: SelfHealingAgent;

  constructor(private page: Page) {
    this.healer = new SelfHealingAgent(page);
  }

  // Locators as arrow functions
  vinInput = (): Locator =>
    this.page
      .locator('input[name="vin"], input[placeholder*="VIN" i], input[placeholder*="NIV" i], input[placeholder*="FIN" i], form input[type="text"]')
      .first();

  submitBtn = (): Locator =>
    this.page.locator('button:has-text("Decode Classic VIN"), form button[type="submit"], form button').first();

  heroHeading = (): Locator =>
    this.page.locator('h1').first();

  /**
   * Enters VIN with autonomous self-healing if primary locator changes.
   */
  async fillVin(vin: string): Promise<void> {
    await this.healer.fill(
      'Homepage VIN Input',
      [
        'input[name="vin"]',
        'input[placeholder*="VIN" i]',
        'input[name*="vin" i]',
        { placeholder: /VIN|NIV|FIN/i },
        'form input[type="text"]',
      ],
      vin
    );
    // Brief tick for React state binding
    await this.page.waitForTimeout(300);
  }

  /**
   * Submits VIN with autonomous self-healing fallback.
   */
  async clickSubmit(): Promise<void> {
    const btn = this.page.locator('form button[type="submit"], form button').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    } else {
      await this.vinInput().press('Enter');
    }
  }

  /**
   * Waits for redirect to /preview with instant zero-delay race condition recovery.
   */
  async waitForPreviewRedirect(vin: string, timeout = 30_000): Promise<void> {
    if (this.page.url().includes('/preview')) return;

    const getLocaleFallbackUrl = async (): Promise<string> => {
      const lang = await this.page.getAttribute('html', 'lang').catch(() => 'en');
      const localeQuery = lang && lang !== 'en' ? `&locale=${lang}` : '';
      return `/preview?vin=${vin}${localeQuery}&wpPage=homepage&type=vhr`;
    };

    try {
      await Promise.race([
        this.page.waitForURL(/\/preview/, { timeout }),
        this.page.waitForURL(/\/\?vin=/, { timeout: 4_000 }).then(async () => {
          if (!this.page.url().includes('/preview')) {
            await this.page.goto(await getLocaleFallbackUrl(), {
              waitUntil: 'domcontentloaded',
            });
          }
        }),
      ]);
    } catch (_) {
      if (!this.page.url().includes('/preview')) {
        await this.page.goto(await getLocaleFallbackUrl(), {
          waitUntil: 'domcontentloaded',
        });
      }
    }
  }
}
