import { Locator, Page } from '@playwright/test';

const BANNER_TEXT = /\d+(?:[.,]\d+)?\s*%\s*(?:discount|off)\b/i;

/**
 * PricingCouponBannerComponent
 * The "You have received N% Discount!" banner shown when a coupon (`?offer=`) is applied.
 */
export class PricingCouponBannerComponent {
  constructor(private page: Page) {}

  banner = (): Locator =>
    this.page
      .locator('main')
      .getByText(BANNER_TEXT)
      .or(this.page.getByRole('status').filter({ hasText: BANNER_TEXT }))
      .or(this.page.getByRole('alert').filter({ hasText: BANNER_TEXT }))
      .first();

  async text(): Promise<string> {
    return (await this.banner().innerText()).trim();
  }

  /** Discount percentage announced by the banner. */
  async percent(): Promise<number> {
    const text = await this.text();
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) throw new Error(`[PricingCouponBannerComponent] No discount percentage in banner "${text}"`);
    return Number(match[1].replace(',', '.'));
  }
}
