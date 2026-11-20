import { expect, Locator, Page } from '@playwright/test';
import { Logger } from '../../utils/Logger';

export interface RevisitBannerSnapshot {
  messageText: string;
  grabButtonText: string;
}

/**
 * Layer 2: RevisitBannerComponent
 * 100% Native Playwright self-healing POM for Homepage Revisit Banner.
 * Zero static timeouts & zero hardcoded currency signs.
 */
export class RevisitBannerComponent {
  private logger = new Logger('RevisitBannerComponent');

  constructor(private page: Page) {}

  container = (): Locator =>
    this.page
      .locator('div.fixed.top-0:has(button:has-text("Grab"))')
      .or(this.page.locator('div:has(> div > div > p:has-text("is ready!"))'))
      .or(this.page.locator('div.fixed:has(button:has-text("No Thanks"))'))
      .first();

  message = (): Locator =>
    this.container()
      .locator('p')
      .or(this.page.locator('p:has-text("is ready!")'))
      .first();

  grabButton = (): Locator =>
    this.container()
      .getByRole('button', { name: /Grab it now/i })
      .or(this.page.getByRole('button', { name: /Grab/i }))
      .or(this.page.getByRole('link', { name: /Grab/i }))
      .first();

  dismissButton = (): Locator =>
    this.container()
      .getByRole('button', { name: /No Thanks/i })
      .or(this.page.getByRole('button', { name: /No Thanks/i }))
      .first();

  /**
   * Waits natively for the async Homepage Revisit Banner and returns its rendered message & Grab CTA text.
   */
  async waitForBanner(): Promise<RevisitBannerSnapshot> {
    await this.container().waitFor({ state: 'visible' });
    await expect(this.grabButton()).toBeVisible();

    const messageText = (await this.message().innerText()).replace(/\s+/g, ' ').trim();
    const grabButtonText = (await this.grabButton().innerText()).replace(/\s+/g, ' ').trim();

    this.logger.pass(`Revisit Banner appeared: "${messageText}" | CTA="${grabButtonText}"`);
    return { messageText, grabButtonText };
  }

  /**
   * Clicks Grab CTA on the Revisit Banner and waits natively for /preview navigation.
   */
  async clickGrabAndWaitForPreview(): Promise<string> {
    await this.grabButton().click();
    await this.page.waitForURL(/\/preview/);
    const landedUrl = this.page.url();
    this.logger.pass(`Grab CTA navigated to Preview: ${landedUrl}`);
    return landedUrl;
  }
}
