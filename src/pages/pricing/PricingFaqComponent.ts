import { Locator, Page } from '@playwright/test';

/**
 * PricingFaqComponent
 * The "Pricing FAQ" accordion and the "View Sample Report" link.
 */
export class PricingFaqComponent {
  constructor(private page: Page) {}

  /** Visible accordion triggers (the questions). */
  questions = (): Locator =>
    this.page
      .getByRole('button', { name: /\?\s*$/ })
      .or(this.page.locator('main button[aria-expanded][aria-controls]').filter({ has: this.page.getByRole('heading') }));

  /** The answer panel controlled by a question trigger. */
  async answerOf(question: Locator): Promise<Locator> {
    const panelId = await question.getAttribute('aria-controls');
    return this.page.locator(`[id="${panelId}"]`);
  }

  sampleReportLink = (): Locator =>
    this.page
      .getByRole('link', { name: /sample report/i })
      .or(this.page.locator('main a[href*="sample"]'))
      .first();
}
