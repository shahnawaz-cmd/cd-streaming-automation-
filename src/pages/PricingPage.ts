import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { PriceParser } from '../utils/PriceParser';

export interface PricingPlanSnapshot {
  label: string;
  price: number;
  currencyToken: string;
}

/**
 * Layer 2: PricingPage (/pricing)
 * Credit plan cards ("1 Credit", "2 Credits", ...) and the "Get Your Report" email dialog.
 */
export class PricingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.navigate('/pricing');
    await expect(this.page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  /** The card that contains the plan label (e.g. "1 Credit") and its Get-report CTA. */
  planCard = (label: string): Locator =>
    this.page
      .locator('div, section, li')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .filter({ has: this.page.getByRole('button', { name: /^Get reports?$/i }) })
      .last();

  getReportButton = (label: string): Locator => this.planCard(label).getByRole('button', { name: /^Get reports?$/i });

  emailDialog = (): Locator => this.page.getByRole('dialog', { name: /Get Your Report/i });

  dialogEmailInput = (): Locator => this.emailDialog().getByRole('textbox', { name: /Enter Email/i });

  proceedToCheckoutButton = (): Locator => this.emailDialog().getByRole('button', { name: /Proceed to Checkout/i });

  /** Reads the plan's displayed total in whatever currency the visitor's location resolves to. */
  async readPlan(label: string): Promise<PricingPlanSnapshot> {
    const text = (await this.planCard(label).innerText()).replace(/\s+/g, ' ');
    const afterTotal = text.split(/Total\s*:/i)[1] ?? text;
    const parsed = PriceParser.parsePrice(afterTotal);
    return { label, price: parsed.amount, currencyToken: parsed.currencyToken };
  }

  /** Clicks the plan CTA, submits the email in the dialog and waits for Checkout. */
  async startCheckout(label: string, email: string): Promise<void> {
    await this.getReportButton(label).click();
    await expect(this.emailDialog()).toBeVisible();
    await this.dialogEmailInput().fill(email);
    await this.proceedToCheckoutButton().click();
    await this.page.waitForURL(/\/checkout/);
  }
}
