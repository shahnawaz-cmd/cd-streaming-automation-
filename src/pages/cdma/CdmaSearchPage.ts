import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

export interface CdmaVinPurchaseLanding {
  url: string;
  pathname: string;
  title: string;
  queryParams: Record<string, string>;
  generationModalVisible: boolean;
}

const SAFE_CDMA_QUERY_KEYS = ['vin', 'type', 'paid', 'generate', 'source'] as const;

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

  reportGenerationDialog = (): Locator =>
    this.page
      .getByRole('dialog')
      .filter({ hasText: /checking records|generating|VIN/i })
      .first();

  memberNavShell = (): Locator =>
    this.page
      .locator('a[href="/members/my-reports"], a[href="/members/search"], a[href="/members/my-garage"]')
      .first();

  /**
   * Waits natively for the app's post-payment auto-navigation into CDMA (/members/...)
   * and verifies the purchased VIN and generation UI without manual goto().
   */
  async waitForVinPurchaseAutoNavigation(vin: string): Promise<CdmaVinPurchaseLanding> {
    await this.page.waitForURL(/\/members\//);
    await expect(
      this.reportGenerationDialog().or(this.memberNavShell()).or(this.reportCreditsLabel()).first()
    ).toBeVisible();

    const parsed = new URL(this.page.url());
    const queryParams: Record<string, string> = {};
    const safeParams = new URLSearchParams();
    for (const key of SAFE_CDMA_QUERY_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value !== null) {
        queryParams[key] = value;
        safeParams.set(key, value);
      }
    }

    if (parsed.pathname.includes('/members/search')) {
      expect(queryParams.vin, 'CDMA /members/search query param vin').toBe(vin);
      expect(queryParams.paid, 'CDMA /members/search query param paid').toBe('true');
      expect(queryParams.generate, 'CDMA /members/search query param generate').toBe('true');
    }

    const dialog = this.reportGenerationDialog();
    const generationModalVisible = await dialog.isVisible().catch(() => false);
    if (generationModalVisible) {
      await expect(dialog, 'CDMA report generation dialog displays purchased VIN').toContainText(vin);
    }

    const safeSearch = safeParams.toString();
    return {
      url: `${parsed.origin}${parsed.pathname}${safeSearch ? `?${safeSearch}` : ''}`,
      pathname: parsed.pathname,
      title: await this.page.title(),
      queryParams,
      generationModalVisible,
    };
  }
}
