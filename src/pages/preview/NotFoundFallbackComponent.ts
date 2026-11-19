import { Page, Locator } from '@playwright/test';

/**
 * NotFoundFallbackComponent
 * Encapsulates the Modern VIN "Vehicle Not Found" fallback banner,
 * error headings, and secondary search form.
 */
export class NotFoundFallbackComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page.locator('section:has-text("We couldn\'t find a vehicle"), div:has-text("We couldn\'t find a vehicle")').first();

  heading = (): Locator =>
    this.page.getByText("We couldn't find a vehicle for this VIN").first();

  helpText = (): Locator =>
    this.page.getByText("Check that the VIN is typed correctly and search again below.").first();

  checkedVinBadge = (vin?: string): Locator =>
    vin ? this.page.getByText(vin).first() : this.page.locator('text=/Checked VIN/i >> xpath=..').first();

  searchAnotherInput = (): Locator =>
    this.page.locator('input[placeholder*="Search another" i], input[placeholder*="VIN" i]').first();

  searchBtn = (): Locator =>
    this.page.locator('button:has-text("Search")').first();

  async isVisible(): Promise<boolean> {
    return this.heading().isVisible().catch(() => false);
  }
}
