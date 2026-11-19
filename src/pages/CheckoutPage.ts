import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Layer 2: CheckoutPage Page Object
 * Encapsulates Checkout page locators and basic interactions.
 */
export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Locators as arrow functions
  heading = (): Locator =>
    this.page.locator('h1, h2').first();

  couponInput = (): Locator =>
    this.page.locator('input[placeholder*="Coupon" i], input[placeholder*="Discount" i], input[name*="coupon" i]').first();

  applyCouponBtn = (): Locator =>
    this.page.locator('button:has-text("Apply")').first();

  totalPrice = (): Locator =>
    this.page.locator('[data-testid="total-price"], .total-price, span:has-text("$")').first();

  emailInput = (): Locator =>
    this.page.locator('input[type="email"], input[name*="email" i]').first();

  payButton = (): Locator =>
    this.page.locator('button:has-text("Pay"), button:has-text("Complete Order"), [data-testid="pay-btn"]').first();
}
