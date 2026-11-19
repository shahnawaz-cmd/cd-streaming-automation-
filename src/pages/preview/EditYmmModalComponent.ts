import { Page, Locator } from '@playwright/test';
import { SelfHealingAgent } from '../../utils/SelfHealingAgent';

/**
 * EditYmmModalComponent
 * Encapsulates Edit button, modal fields (Year, Make, Model, Trim), and Save actions.
 */
export class EditYmmModalComponent {
  private healer: SelfHealingAgent;

  constructor(private page: Page) {
    this.healer = new SelfHealingAgent(page);
  }

  // Locators as arrow functions
  editBtn = (): Locator =>
    this.page.locator('button:has-text("Edit"), a:has-text("Edit"), [data-testid="edit-ymm"]').first();

  modalContainer = (): Locator =>
    this.page.locator('[data-testid="edit-ymm-modal"], .edit-ymm-modal, [role="dialog"]').first();

  yearSelect = (): Locator =>
    this.page.locator('select[name="year"], [data-testid="year-select"]').first();

  makeSelect = (): Locator =>
    this.page.locator('select[name="make"], [data-testid="make-select"]').first();

  modelSelect = (): Locator =>
    this.page.locator('select[name="model"], [data-testid="model-select"]').first();

  trimSelect = (): Locator =>
    this.page.locator('select[name="trim"], [data-testid="trim-select"], input[name="trim"]').first();

  saveBtn = (): Locator =>
    this.page.locator('button:has-text("Save"), button:has-text("Update"), [data-testid="save-ymm"]').first();

  closeBtn = (): Locator =>
    this.page.locator('button[aria-label="Close"], button:has-text("Cancel")').first();

  async open(): Promise<void> {
    await this.editBtn().click();
    await this.modalContainer().waitFor({ state: 'visible', timeout: 10_000 });
  }

  async selectTrim(trim: string): Promise<void> {
    await this.trimSelect().waitFor({ state: 'visible' });
    if ((await this.trimSelect().evaluate((el) => el.tagName.toLowerCase())) === 'select') {
      await this.trimSelect().selectOption({ label: trim });
    } else {
      await this.trimSelect().fill(trim);
    }
  }

  async save(): Promise<void> {
    await this.saveBtn().click();
    await this.modalContainer().waitFor({ state: 'hidden', timeout: 10_000 });
  }
}
