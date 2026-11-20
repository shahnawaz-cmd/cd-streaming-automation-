import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Layer 2: CdmaSearchPage (/members/search)
 * Members area landing after a successful purchase; exposes the account's credit balances.
 */
export class CdmaSearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForLanding(): Promise<void> {
    await this.page.waitForURL(/\/members\//);
    await expect(this.reportCreditsLabel()).toBeVisible();
  }

  reportCreditsLabel = (): Locator =>
    this.page
      .getByText(/^Report Credits\s*:?/i)
      .or(this.page.locator('aside, nav').getByText(/Report\s+Credits/i))
      .first();

  buildSheetCreditsLabel = (): Locator =>
    this.page
      .getByText(/^Build Sheet Credits\s*:?/i)
      .or(this.page.locator('aside, nav').getByText(/Build\s*Sheet\s+Credits/i))
      .first();

  /** Credit count shown next to a label ("Report Credits : 1"), read from the label's container. */
  private async creditsNextTo(label: Locator): Promise<number> {
    const text = (await label.locator('xpath=..').innerText()).replace(/\s+/g, ' ');
    const match = text.match(/:\s*(\d+)/);
    if (!match) throw new Error(`[CdmaSearchPage] Could not read a credit count from "${text}"`);
    return Number(match[1]);
  }

  reportCredits(): Promise<number> {
    return this.creditsNextTo(this.reportCreditsLabel());
  }

  buildSheetCredits(): Promise<number> {
    return this.creditsNextTo(this.buildSheetCreditsLabel());
  }
}
