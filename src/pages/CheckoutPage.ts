import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { PriceParser } from '../utils/PriceParser';

export interface CheckoutStructuredContent {
  url: string;
  htmlLang: string | null;
  headings: string[];
  buttons: string[];
  bodyText: string;
}

export interface CheckoutDecodedPayload {
  code?: string;
  type?: string;
  vin?: string;
  email?: string;
  extra?: boolean;
  subscription?: boolean;
  nos?: number;
  itemLabel?: string;
  price?: number;
  addOnPrice?: number;
  addOnLabel?: string;
  currencySign?: string;
  currency?: string;
}

export interface CheckoutOrderSummary {
  url: string;
  decodedData: CheckoutDecodedPayload | null;
  summaryText: string;
  packageAmount: number;
  addOnAmount: number;
  totalAmount: number;
  payButtonText: string;
  payButtonAmount: number;
  currencyToken: string;
}

/**
 * Layer 2: CheckoutPage Page Object
 * 100% Native Playwright self-healing locators & currency-agnostic Order Summary extraction.
 */
export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  heading = (): Locator =>
    this.page
      .getByRole('heading', { level: 1 })
      .or(this.page.locator('h1, h2'))
      .first();

  couponInput = (): Locator =>
    this.page
      .locator('input[placeholder*="Coupon" i], input[placeholder*="Discount" i], input[name*="coupon" i]')
      .or(this.page.locator('aside input[type="text"], section input[type="text"]'))
      .first();

  applyCouponBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /^Apply$/i })
      .or(this.page.locator('button:has-text("Apply")'))
      .first();

  orderSummarySection = (): Locator =>
    this.page
      .locator('section:has(h2:has-text("Order summary"))')
      .or(this.page.locator('div:has(> h2:has-text("Order summary"))'))
      .or(this.page.locator('section:has-text("PACKAGE"):has-text("Total")'))
      .or(this.page.locator('aside:has-text("Order summary")'))
      .first();

  payButton = (): Locator =>
    this.page
      .getByRole('button', { name: /^(?:Pay|Subscribe|Complete Order)\b.*\d/i })
      .or(this.page.locator('form button[type="submit"]').filter({ hasText: /\d/ }))
      .or(this.page.locator('button:has-text("Pay"), button:has-text("Subscribe")').filter({ hasText: /\d/ }))
      .or(this.page.locator('[data-testid="pay-btn"]'))
      .first();

  totalPrice = (): Locator =>
    this.orderSummarySection()
      .locator('div:has(> :text-is("Total")), tr:has(:text-is("Total"))')
      .or(this.page.locator('[data-testid="total-price"], .total-price'))
      .first();

  emailInput = (): Locator =>
    this.page
      .locator('input[type="email"], input[name*="email" i]')
      .first();

  private findSectionAmount(lines: string[], headingPattern: RegExp, labelName: string): number {
    const idx = lines.findIndex((line) => headingPattern.test(line));
    if (idx === -1) {
      throw new Error(`[CheckoutPage] Could not locate "${labelName}" section in Order Summary:\n${lines.join('\n')}`);
    }
    const candidateSameLine = lines[idx].replace(headingPattern, '').trim();
    if (candidateSameLine) {
      const parsed = PriceParser.tryParseCurrencyLine(candidateSameLine);
      if (parsed) return parsed.amount;
    }
    for (let j = idx + 1; j <= Math.min(idx + 3, lines.length - 1); j++) {
      const parsed = PriceParser.tryParseCurrencyLine(lines[j]);
      if (parsed) return parsed.amount;
    }
    throw new Error(`[CheckoutPage] Could not parse price under "${labelName}" in Order Summary:\n${lines.join('\n')}`);
  }

  /** Stripe Payment Element iframe (card number / expiry / CVC live inside it). */
  stripeFrame = () =>
    this.page
      .frameLocator('iframe[title="Secure payment input frame"], iframe[name^="__privateStripeFrame"], iframe[src*="elements-inner-payment"]')
      .first();

  /** Fills the Stripe card form with a test card and submits payment. */
  async payWithCard(card: { number: string; expiry: string; cvc: string }): Promise<void> {
    const stripe = this.stripeFrame();
    await stripe
      .getByRole('textbox', { name: /Card number/i })
      .or(stripe.getByPlaceholder(/1234 1234 1234 1234/))
      .or(stripe.locator('input[name="number"], input[autocomplete="cc-number"]'))
      .first()
      .fill(card.number);
    await stripe
      .getByRole('textbox', { name: /Expiration/i })
      .or(stripe.getByPlaceholder(/MM\s*\/\s*YY/i))
      .or(stripe.locator('input[name="expiry"], input[autocomplete="cc-exp"]'))
      .first()
      .fill(card.expiry);
    await stripe
      .getByRole('textbox', { name: /Security code|CVC/i })
      .or(stripe.getByPlaceholder(/CVC/i))
      .or(stripe.locator('input[name="cvc"], input[autocomplete="cc-csc"]'))
      .first()
      .fill(card.cvc);
    await expect(this.payButton()).toBeEnabled();
    await this.payButton().click();
  }

  /**
   * Asserts the user has landed on the checkout page with zero inline static timeouts.
   */
  async verifyLandedOnCheckout(): Promise<void> {
    await this.page.waitForURL(/\/checkout/);
    await expect(this.heading()).toBeVisible();
  }

  /**
   * Reads Order Summary line items, Pay CTA amount, and decoded checkout URL payload.
   * Never calls networkidle (Stripe iframe keeps sockets active) and never hardcodes currency signs.
   */
  async readOrderSummary(): Promise<CheckoutOrderSummary> {
    await this.verifyLandedOnCheckout();
    await expect(this.orderSummarySection()).toBeVisible();
    await expect(this.payButton()).toBeVisible();

    const summaryText = (await this.orderSummarySection().innerText()).trim();
    const lines = summaryText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const packageAmount = this.findSectionAmount(lines, /^PACKAGE\b/i, 'PACKAGE');
    const addOnAmount = this.findSectionAmount(lines, /^ADD-ON\b/i, 'ADD-ON');
    const totalAmount = this.findSectionAmount(lines, /^Total\b/i, 'Total');

    const payButtonText = (await this.payButton().innerText()).replace(/\s+/g, ' ').trim();
    const parsedPay = PriceParser.parseLastPrice(payButtonText);

    const url = this.page.url();
    const decodedData = this.readDecodedPayload();

    return {
      url,
      decodedData,
      summaryText,
      packageAmount,
      addOnAmount,
      totalAmount,
      payButtonText,
      payButtonAmount: parsedPay.amount,
      currencyToken: parsedPay.currencyToken,
    };
  }

  /**
   * Decodes the base64 `data` checkout URL payload (vin, email, code, price, ...). Null if absent/invalid.
   */
  readDecodedPayload(): CheckoutDecodedPayload | null {
    const dataParam = new URL(this.page.url()).searchParams.get('data');
    if (!dataParam) return null;
    try {
      return JSON.parse(Buffer.from(dataParam, 'base64').toString('utf8')) as CheckoutDecodedPayload;
    } catch {
      return null;
    }
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
