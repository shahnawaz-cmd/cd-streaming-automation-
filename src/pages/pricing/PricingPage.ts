import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { PricingPlansComponent } from './PricingPlansComponent';
import { PricingCouponBannerComponent } from './PricingCouponBannerComponent';
import { PricingEmailDialogComponent } from './PricingEmailDialogComponent';

/**
 * Layer 2: PricingPage (/pricing)
 * Thin page object composing focused components: plan cards & toggle, coupon banner and the email dialog.
 */
export class PricingPage extends BasePage {
  readonly plans: PricingPlansComponent;
  readonly coupon: PricingCouponBannerComponent;
  readonly emailDialog: PricingEmailDialogComponent;

  constructor(page: Page) {
    super(page);
    this.plans = new PricingPlansComponent(page);
    this.coupon = new PricingCouponBannerComponent(page);
    this.emailDialog = new PricingEmailDialogComponent(page);
  }

  heading = (): Locator => this.page.getByRole('heading', { level: 1 }).or(this.page.locator('main h1')).first();

  async open(): Promise<void> {
    await this.navigate('/pricing');
    await expect(this.heading()).toBeVisible();
  }

  async openWithCoupon(code: string): Promise<void> {
    await this.navigate(`/pricing?offer=${encodeURIComponent(code)}`);
    await expect(this.plans.cards().first()).toBeVisible();
  }

  /** Clicks the plan CTA, submits the email in the dialog and waits for Checkout. */
  async startCheckout(planName: string, email: string): Promise<void> {
    await this.plans.getButton(planName).click();
    await expect(this.emailDialog.dialog()).toBeVisible();
    await this.emailDialog.emailInput().fill(email);
    await this.emailDialog.proceedButton().click();
    await this.page.waitForURL(/\/checkout/);
  }
}
