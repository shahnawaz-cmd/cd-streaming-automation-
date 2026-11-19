import { Page, Locator } from '@playwright/test';

/**
 * ClassicFallbackComponent
 * Encapsulates the Classic VIN fallback "Update Your Vehicle Details" manual form,
 * Year/Make/Model/Trim dropdowns, and "Get Records" button.
 */
export class ClassicFallbackComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page.locator('section:has-text("Update Your Vehicle Details"), div:has-text("Update Your Vehicle Details")').first();

  heading = (): Locator =>
    this.page.getByText("Update Your Vehicle Details").first();

  subheading = (): Locator =>
    this.page.getByText("Edit the details below, then select your trim.").first();

  checkedVinBadge = (vin?: string): Locator =>
    vin ? this.page.getByText(vin).first() : this.page.locator('text=/Checked VIN/i >> xpath=..').first();

  yearSelect = (): Locator =>
    this.page.locator('select[name="year"], [data-testid="fallback-year"]').first();

  makeSelect = (): Locator =>
    this.page.locator('select[name="make"], [data-testid="fallback-make"]').first();

  modelSelect = (): Locator =>
    this.page.locator('select[name="model"], [data-testid="fallback-model"]').first();

  trimSelect = (): Locator =>
    this.page.locator('select[name="trim"], [data-testid="fallback-trim"]').first();

  getRecordsBtn = (): Locator =>
    this.page.locator('button:has-text("Get Records")').first();

  cantFindLink = (): Locator =>
    this.page.locator('text=/Can\'t find your vehicle listed above/i').first();

  async isVisible(): Promise<boolean> {
    return this.heading().isVisible().catch(() => false);
  }
}
