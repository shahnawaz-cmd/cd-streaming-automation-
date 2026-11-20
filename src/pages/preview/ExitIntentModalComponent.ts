import { Page, Locator, expect } from '@playwright/test';

/**
 * ExitIntentModalComponent
 * Encapsulates Exit Intent banner, discount popup, email input, claim button, and coupon guard.
 */
export class ExitIntentModalComponent {
  constructor(private page: Page) {}

  modalContainer = (): Locator =>
    this.page.locator('dialog, [role="dialog"]').first();

  heading = (): Locator =>
    this.page.locator('dialog h2, [role="dialog"] h2').first();

  emailInput = (): Locator =>
    this.page.locator('dialog input, [role="dialog"] input').first();

  claimDiscountBtn = (): Locator =>
    this.page.locator('dialog button:has-text("15% OFF"), [role="dialog"] button:has-text("15% OFF")').first();

  declineBtn = (): Locator =>
    this.page.locator('dialog button:has-text("Close"), [role="dialog"] button:has-text("Close")').first();

  applyingBanner = (): Locator =>
    this.page.locator('text=/Applying your discount/i').first();

  /**
   * Simulates mouse moving out of viewport to trigger exit-intent popup
   */
  async trigger(): Promise<void> {
    await this.page.mouse.move(300, 200);
    await this.page.mouse.move(300, 0);
    await this.page.evaluate(() => {
      const opts = {
        bubbles: true,
        cancelable: true,
        clientX: 300,
        clientY: -1,
        relatedTarget: null,
      };
      document.dispatchEvent(new MouseEvent('mouseleave', opts));
      document.documentElement.dispatchEvent(new MouseEvent('mouseleave', opts));
      document.dispatchEvent(new MouseEvent('mouseout', opts));
      document.documentElement.dispatchEvent(new MouseEvent('mouseout', opts));
      window.dispatchEvent(new MouseEvent('mouseout', opts));
      window.dispatchEvent(new MouseEvent('mouseleave', opts));
    });
  }

  async isVisible(): Promise<boolean> {
    return this.heading().isVisible().catch(() => false);
  }

  /**
   * Fills email and submits popup using force click to bypass modal backdrop animations
   */
  async submitEmail(email: string = 'test@example.com'): Promise<void> {
    const input = this.emailInput();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click({ force: true });
    await input.fill(email);

    const btn = this.claimDiscountBtn();
    await btn.waitFor({ state: 'visible', timeout: 5_000 });
    await btn.click({ force: true });
  }

  /**
   * Registers a scoped Playwright locator handler to dismiss unexpected Exit-Intent
   * popups that intercept pointer events during unrelated Preview actions.
   */
  static async runWithOverlayGuard<T>(page: Page, action: () => Promise<T>): Promise<T> {
    const exitIntentDialog = page
      .getByRole('dialog', { name: /15% OFF|Before you go/i })
      .or(page.locator('[role="dialog"], dialog').filter({ hasText: /15% OFF|Before you go/i }))
      .first();

    const closeBtn = exitIntentDialog
      .getByRole('button', { name: /Close/i })
      .or(exitIntentDialog.locator('button[aria-label*="close" i], button:has-text("Close")'))
      .first();

    await page.addLocatorHandler(exitIntentDialog, async () => {
      await expect(async () => {
        if (await closeBtn.isVisible()) {
          await closeBtn.click({ force: true });
        } else if (await exitIntentDialog.isVisible()) {
          await page.keyboard.press('Escape');
        }
        expect(await exitIntentDialog.isVisible()).toBe(false);
      }).toPass();
    });

    try {
      return await action();
    } finally {
      await page.removeLocatorHandler(exitIntentDialog);
    }
  }
}
