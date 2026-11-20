import { Locator, Page } from '@playwright/test';

/**
 * PricingEmailDialogComponent
 * The "Get Your Report" dialog that collects the delivery email before Checkout.
 */
export class PricingEmailDialogComponent {
  constructor(private page: Page) {}

  dialog = (): Locator =>
    this.page
      .getByRole('dialog', { name: /Get Your Report/i })
      .or(this.page.locator('[role="dialog"], dialog').filter({ hasText: /Get Your Report/i }))
      .first();

  emailInput = (): Locator =>
    this.dialog()
      .getByRole('textbox', { name: /Enter Email/i })
      .or(this.dialog().getByPlaceholder(/email/i))
      .or(this.dialog().locator('input[type="email"], input[name*="email" i]'))
      .first();

  proceedButton = (): Locator =>
    this.dialog()
      .getByRole('button', { name: /Proceed to Checkout/i })
      .or(this.dialog().locator('button[type="submit"]'))
      .first();
}
