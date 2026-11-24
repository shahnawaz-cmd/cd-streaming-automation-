import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { Logger } from '../utils/Logger';

/**
 * Layer 2: BuildSheetPage (/build-sheet)
 * Self-healing Page Object for entering and submitting a VIN on the Build Sheet landing page.
 * Strictly zero static waits and 100% Playwright native timeouts.
 */
export class BuildSheetPage extends BasePage {
  private logger = new Logger('BuildSheetPage');

  constructor(page: Page) {
    super(page);
  }

  vinInput = (): Locator =>
    this.page
      .locator('form input[name="vin"]')
      .or(this.page.getByPlaceholder(/Enter VIN/i))
      .or(this.page.locator('form input[type="text"]'))
      .first();

  submitBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /Get Build Sheet/i })
      .or(this.page.locator('form button[type="submit"]'))
      .first();

  /** Opens /build-sheet waiting natively for network idle and visible VIN controls. */
  async open(): Promise<void> {
    await this.page.goto('/build-sheet', { waitUntil: 'networkidle' });
    await expect(this.vinInput()).toBeVisible();
    await expect(this.submitBtn()).toBeVisible();
  }

  /** Submits the VIN on /build-sheet and waits natively for the sticker Preview redirect. */
  async submitVinAndWaitForPreview(vin: string): Promise<void> {
    this.logger.step(`Enter VIN and submit on /build-sheet: ${vin}`);
    await this.open();

    await expect(async () => {
      if (!this.page.url().includes('/preview')) {
        await this.vinInput().fill(vin);
        await expect(this.vinInput()).toHaveValue(vin);
        await this.submitBtn().click();
      }
      await expect(this.page).toHaveURL(/\/preview/);
    }).toPass();

    const params = new URL(this.page.url()).searchParams;
    expect(params.get('vin'), 'Build Sheet Preview URL vin').toBe(vin);
    expect(params.get('type'), 'Build Sheet Preview URL type').toBe('sticker');
    this.logger.pass(`Redirected /build-sheet -> Preview (sticker) for VIN: ${vin}`);
  }
}
