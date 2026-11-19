import { Page, Locator } from '@playwright/test';

/**
 * HomeExitIntentComponent
 * Encapsulates the Homepage exit-intent modal, discount banners, and coupon claims.
 */
export class HomeExitIntentComponent {
  constructor(private page: Page) {}

  modalContainer = (): Locator =>
    this.page.locator('[data-testid="exit-intent-modal"], .exit-modal, [role="dialog"]').first();

  discountBanner = (): Locator =>
    this.page.locator('text=/10% OFF|Special Offer|Wait!|Don\'t leave/i').first();

  claimCouponBtn = (): Locator =>
    this.page.locator('button:has-text("Claim Discount"), button:has-text("Apply Coupon")').first();

  closeModalBtn = (): Locator =>
    this.page.locator('button[aria-label="Close"], button:has-text("No thanks")').first();

  /**
   * Simulates moving cursor out of top viewport to trigger the exit-intent discount popup
   */
  async trigger(): Promise<void> {
    await this.page.mouse.move(500, 200);
    await this.page.mouse.move(500, 0);
  }
}
