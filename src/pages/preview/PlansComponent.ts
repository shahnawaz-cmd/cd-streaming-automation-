import { Page, Locator } from '@playwright/test';

/**
 * PlansComponent
 * Encapsulates the pricing tiers/plans, Save % badges, and plan cards on Preview page.
 */
export class PlansComponent {
  constructor(private page: Page) {}

  plansContainer = (): Locator =>
    this.page.locator('[aria-label="Choose Package"], div:has(h2:has-text("Choose Package")), div:has-text("10 reports")').first();

  saveBadges = (): Locator =>
    this.page.locator('text=/Save \d+%/i');

  planCard = (reports: number): Locator =>
    this.page.locator(`div:has-text("${reports} Report"), div:has-text("${reports} Reports")`).first();

  tenReportsPlan = (): Locator =>
    this.page.locator('text=/10 Reports/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  twoReportsPlan = (): Locator =>
    this.page.locator('text=/2 Reports/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  oneReportPlan = (): Locator =>
    this.page.locator('text=/1 Report/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  async getSaveTags(): Promise<string[]> {
    const badges = this.saveBadges();
    const count = await badges.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }
}
