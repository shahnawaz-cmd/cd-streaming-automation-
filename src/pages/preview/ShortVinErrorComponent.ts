import { Locator, Page } from '@playwright/test';

/**
 * Layer 2: ShortVinErrorComponent
 * 100% Native Playwright self-healing POM using official locator.or() multi-strategy chains
 * for the Preview page malformed short VIN (<5 chars) rejection UI.
 * Zero static sleeps — strictly web-first auto-retrying assertions.
 */
export class ShortVinErrorComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page
      .locator('section:has(h1)')
      .or(this.page.locator('div:has(h1):has(button[type="submit"])'))
      .or(this.page.locator('main'))
      .first();

  heading = (): Locator =>
    this.page
      .getByRole('heading', { name: /That VIN doesn[’']t look right/i })
      .or(this.page.getByText(/That VIN doesn[’']t look right/i))
      .or(this.page.locator('main h1'))
      .first();

  subtext = (): Locator =>
    this.page
      .getByText(/Check it for typos and search again below/i)
      .or(this.container().locator('p').filter({ hasText: /typos|search again/i }))
      .first();

  checkedVinBadge = (vin: string): Locator =>
    this.container()
      .getByText(vin, { exact: true })
      .or(this.page.locator('*:has-text("Checked VIN") >> text=' + vin))
      .or(this.page.getByText(vin, { exact: true }))
      .first();

  searchInput = (): Locator =>
    this.page
      .getByPlaceholder(/Enter VIN/i)
      .or(this.page.locator('input[placeholder*="VIN" i]'))
      .or(this.container().locator('input[type="text"]'))
      .first();

  searchBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /^Search$/i })
      .or(this.container().locator('button[type="submit"]'))
      .or(this.page.locator('button:has-text("Search")'))
      .first();

  noPurchaseStatusBanner = (): Locator =>
    this.page
      .getByRole('status')
      .filter({ hasText: /There is no vehicle for this VIN, so there is nothing to purchase/i })
      .or(this.page.getByRole('alert').filter({ hasText: /nothing to purchase/i }))
      .or(this.page.getByText(/nothing to purchase/i))
      .first();
}
