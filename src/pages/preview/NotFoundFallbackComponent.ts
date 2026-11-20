import { Page, Locator } from '@playwright/test';

/**
 * NotFoundFallbackComponent
 * Encapsulates the Modern VIN "Vehicle Not Found" fallback banner,
 * error headings, and secondary search form.
 */
export class NotFoundFallbackComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page
      .locator('section:has-text("We couldn\'t find a vehicle"), div:has-text("We couldn\'t find a vehicle")')
      .or(this.page.locator('main > div:has(h1:has-text("doesn’t look right")), main > div:has(h1:has-text("doesn\'t look right"))'))
      .first();

  heading = (): Locator =>
    this.page
      .getByText("We couldn't find a vehicle for this VIN")
      .or(this.page.getByRole('heading', { name: /That VIN doesn[’']t look right/i }))
      .or(this.page.getByText(/That VIN doesn[’']t look right/i))
      .first();

  helpText = (): Locator =>
    this.page
      .getByText("Check that the VIN is typed correctly and search again below.")
      .or(this.page.getByText(/Check it for typos and search again below/i))
      .first();

  checkedVinBadge = (vin?: string): Locator =>
    vin ? this.page.getByText(vin).first() : this.page.locator('text=/Checked VIN/i >> xpath=..').first();

  searchAnotherInput = (): Locator =>
    this.page.locator('input[placeholder*="Search another" i], input[placeholder*="VIN" i]').first();

  searchBtn = (): Locator =>
    this.page.locator('button:has-text("Search")').first();

  /** Transient backend failure state: "We couldn't look up this VIN right now ... Try again". */
  lookupFailedHeading = (): Locator =>
    this.page
      .getByText(/couldn.t look up this VIN right now/i)
      .or(this.page.getByRole('button', { name: /^Try again$/i }))
      .first();

  async isVisible(): Promise<boolean> {
    return this.heading().isVisible().catch(() => false);
  }
}
