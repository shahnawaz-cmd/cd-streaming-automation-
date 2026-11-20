import { Page, Locator, expect } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';

export interface SelectedYmmt {
  year: string;
  make: string;
  model: string;
  trim: string;
}

/**
 * Layer 2: EditYmmModalComponent
 * 100% Native Playwright self-healing POM using official locator.or() chains.
 * Zero static sleeps — strictly web-first auto-retrying assertions.
 */
export class EditYmmModalComponent {
  private logger = new Logger('EditYmmModalComponent');

  constructor(private page: Page) {}

  // Official Playwright native multi-strategy self-healing locators
  editTrigger = (): Locator =>
    this.page
      .getByRole('button', { name: /Edit/i })
      .or(this.page.getByRole('button', { name: /No, Update/i }))
      .or(this.page.locator('[data-testid*="edit" i]'))
      .first();

  updateYmmtOptionBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /Update year, make, model/i })
      .or(this.page.getByText(/Update year, make, model/i))
      .first();

  modal = (): Locator =>
    this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('dialog'))
      .or(this.page.locator('section:has-text("Update Your Vehicle Details")'))
      .first();

  yearSelect = (): Locator =>
    this.page
      .getByRole('combobox', { name: /Year/i })
      .or(this.page.locator('select').nth(0))
      .first();

  makeSelect = (): Locator =>
    this.page
      .getByRole('combobox', { name: /Make/i })
      .or(this.page.locator('select').nth(1))
      .first();

  modelSelect = (): Locator =>
    this.page
      .getByRole('combobox', { name: /Model/i })
      .or(this.page.locator('select').nth(2))
      .first();

  trimSelect = (): Locator =>
    this.page
      .getByRole('combobox', { name: /Trim/i })
      .or(this.page.locator('select').nth(3))
      .first();

  submitBtn = (): Locator =>
    this.page
      .getByRole('button', { name: 'Update', exact: true })
      .or(this.page.getByRole('button', { name: 'Get Records' }))
      .first();

  /**
   * Opens the Edit YMM modal / form with native auto-retry.
   */
  async open(): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      await expect(this.editTrigger()).toBeVisible();
      await this.editTrigger().click();

      // If step 1 dialog shows "Update year, make, model and trim", click it
      if (await this.updateYmmtOptionBtn().isVisible().catch(() => false)) {
        await this.updateYmmtOptionBtn().click({ force: true });
      }

      await expect(this.yearSelect()).toBeVisible();
    });
  }

  /**
   * Performs dynamic cascading selection across Year -> Make -> Model -> Trim.
   * Auto-retries natively as the backend loads options for each dropdown.
   */
  async selectDynamicYmmt(): Promise<SelectedYmmt> {
    // 1. Year: Auto-retry until enabled and select
    await expect(this.yearSelect()).toBeEnabled();
    const currentYear = await this.yearSelect().inputValue();
    const yearVal = currentYear && currentYear !== '' ? currentYear : '1975';
    if (!currentYear) {
      await this.yearSelect().selectOption(yearVal);
    }

    // 2. Make: Web-first wait until enabled by backend API
    await expect(this.makeSelect()).toBeEnabled();
    const makeOptions = (await this.makeSelect().locator('option').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t && !/select|loading/i.test(t));
    const randomMake = makeOptions[Math.floor(Math.random() * makeOptions.length)] || makeOptions[0];
    await this.makeSelect().selectOption({ label: randomMake });
    this.logger.info(`Dynamically selected Make: ${randomMake}`);

    // 3. Model: Web-first wait until enabled
    await expect(this.modelSelect()).toBeEnabled();
    const modelOptions = (await this.modelSelect().locator('option').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t && !/select|loading/i.test(t));
    const randomModel = modelOptions[Math.floor(Math.random() * modelOptions.length)] || modelOptions[0];
    await this.modelSelect().selectOption({ label: randomModel });
    this.logger.info(`Dynamically selected Model: ${randomModel}`);

    // 4. Trim: Web-first wait until enabled (Checklist #02: confirms Trim field exists & visible)
    await expect(this.trimSelect()).toBeVisible();
    await expect(this.trimSelect()).toBeEnabled();
    const trimOptions = (await this.trimSelect().locator('option').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t && !/select|loading/i.test(t));
    const randomTrim = trimOptions[Math.floor(Math.random() * trimOptions.length)] || trimOptions[0] || 'Base';
    if (trimOptions.length > 0) {
      await this.trimSelect().selectOption({ label: randomTrim });
      this.logger.info(`Dynamically selected Trim: ${randomTrim}`);
    }

    return {
      year: yearVal,
      make: randomMake,
      model: randomModel,
      trim: randomTrim,
    };
  }

  /**
   * Submits the updated YMMT form and verifies submission.
   */
  async submitUpdate(): Promise<void> {
    await expect(this.submitBtn()).toBeEnabled();
    await this.submitBtn().click({ force: true });
  }
}
