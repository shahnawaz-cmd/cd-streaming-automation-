import { Page, Locator, expect } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import { DynamicVehicleSpecs } from '../../data/SpecsGenerator';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';

/**
 * Layer 2: EditSpecsModalComponent
 * 100% Native Playwright self-healing POM for the "Update specifications" modal.
 * Zero static timeouts — purely native Playwright web-first auto-retrying assertions.
 */
export class EditSpecsModalComponent {
  private logger = new Logger('EditSpecsModalComponent');

  constructor(private page: Page) {}

  // Native self-healing locators using Playwright .or() chains
  editTrigger = (): Locator =>
    this.page
      .getByRole('button', { name: /Edit/i })
      .or(this.page.getByRole('button', { name: /No, Update/i }))
      .or(this.page.locator('[data-testid*="edit" i]'))
      .first();

  updateSpecsOptionBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /Update specifications/i })
      .or(this.page.getByText(/Update specifications/i))
      .first();

  modal = (): Locator =>
    this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('dialog'))
      .first();

  // Native input locators using getByLabel
  bodyMakerInput = (): Locator =>
    this.page.getByLabel(/Body Maker/i).first();

  engineTypeInput = (): Locator =>
    this.page.getByLabel(/Engine Type/i).first();

  displacementInput = (): Locator =>
    this.page.getByLabel(/Displacement/i).first();

  cylindersInput = (): Locator =>
    this.page.getByLabel(/Cylinders/i).first();

  torqueInput = (): Locator =>
    this.page.getByLabel(/Torque/i).first();

  noOfGearsInput = (): Locator =>
    this.page.getByLabel(/No\. Of Gears/i).first();

  fuelCapacityInput = (): Locator =>
    this.page.getByLabel(/Fuel capacity/i).first();

  weightInput = (): Locator =>
    this.page.getByLabel(/Weight/i).first();

  submitBtn = (): Locator =>
    this.page
      .getByRole('button', { name: 'Update', exact: true })
      .or(this.page.getByRole('button', { name: 'Save' }))
      .first();

  /**
   * Opens the "Update specifications" modal using native web-first auto-retrying.
   */
  async open(): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      await expect(this.editTrigger()).toBeVisible();
      await this.editTrigger().click();

      await expect(this.updateSpecsOptionBtn()).toBeVisible();
      await this.updateSpecsOptionBtn().click({ force: true });

      await expect(this.engineTypeInput()).toBeVisible();
    });
  }

  /**
   * Fills dynamic specifications into the modal inputs.
   */
  async fillSpecs(specs: DynamicVehicleSpecs): Promise<void> {
    await expect(this.engineTypeInput()).toBeVisible();
    await this.engineTypeInput().fill(specs.engineType);

    if (await this.displacementInput().isVisible().catch(() => false)) {
      await this.displacementInput().fill(specs.displacement);
    }
    if (await this.cylindersInput().isVisible().catch(() => false)) {
      await this.cylindersInput().fill(specs.cylinders);
    }
    if (await this.torqueInput().isVisible().catch(() => false)) {
      await this.torqueInput().fill(specs.torque);
    }
    if (await this.noOfGearsInput().isVisible().catch(() => false)) {
      await this.noOfGearsInput().fill(specs.noOfGears);
    }
    if (await this.fuelCapacityInput().isVisible().catch(() => false)) {
      await this.fuelCapacityInput().fill(specs.fuelCapacity);
    }
    if (await this.weightInput().isVisible().catch(() => false)) {
      await this.weightInput().fill(specs.weight);
    }
    if (await this.bodyMakerInput().isVisible().catch(() => false)) {
      await this.bodyMakerInput().fill(specs.bodyMaker);
    }

    this.logger.info(`Filled specifications: Engine="${specs.engineType}", Disp="${specs.displacement}", Cyl="${specs.cylinders}"`);
  }

  /**
   * Submits the updated specifications form and natively waits until pop-up closes.
   */
  async submitUpdate(): Promise<void> {
    await expect(this.submitBtn()).toBeEnabled();
    await this.submitBtn().click({ force: true });
    // Native Playwright wait: wait until pop-up closes as server processes the update
    await this.modal().waitFor({ state: 'hidden', timeout: 60_000 });
  }
}
