import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CheckoutStructuredContent {
  url: string;
  htmlLang: string | null;
  headings: string[];
  buttons: string[];
  bodyText: string;
}

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

  /**
   * Asserts the user has landed on the checkout page with zero inline static timeouts.
   */
  async verifyLandedOnCheckout(): Promise<void> {
    await this.page.waitForURL(/\/checkout/);
    await expect(this.heading()).toBeVisible();
  }

  /**
   * Scrapes structured text content from the checkout page for localization validation.
   */
  async getCheckoutText(): Promise<string> {
    return (await this.page.locator('main, body').first().innerText().catch(() => '')) || '';
  }

  /**
   * Captures structured headings, visible button labels, URL, html[lang], and body text from Checkout DOM.
   */
  async captureStructuredContent(): Promise<CheckoutStructuredContent> {
    return this.page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const mainEl = (document.querySelector('main') || document.body) as HTMLElement;
      return {
        url: location.href,
        htmlLang: document.documentElement.getAttribute('lang'),
        headings,
        buttons,
        bodyText: (mainEl?.innerText || '').trim(),
      };
    });
  }
}
