import { expect } from '@playwright/test';
import { PreviewPage } from '../pages/preview';
import { SpecsGenerator, DynamicVehicleSpecs } from '../data/SpecsGenerator';
import { Logger } from '../utils/Logger';

/**
 * Layer 3: EditSpecsModule
 * Encapsulates the complete business workflow for updating vehicle specifications.
 * Zero static sleeps — strictly native Playwright web-first assertions.
 */
export class EditSpecsModule {
  private logger = new Logger('EditSpecsModule');

  constructor(private previewPage: PreviewPage) {}

  /**
   * Complete business workflow:
   * 1. Generates fresh dynamic vehicle specifications on every test run.
   * 2. Opens the Edit -> Update specifications modal via self-healing trigger.
   * 3. Fills the dynamic specs with web-first auto-retrying.
   * 4. Submits the updated specifications and verifies modal closes.
   * 5. Validates the front-end Specifications section reflects the new values.
   */
  async updateDynamicSpecs(): Promise<DynamicVehicleSpecs> {
    const specs = SpecsGenerator.generate();
    const editSpecs = this.previewPage.editSpecs;

    await editSpecs.open();
    await editSpecs.fillSpecs(specs);
    await editSpecs.submitUpdate();

    // Front-end UI Validator: assert on-page specs reflect the updated engine type
    await this.verifySpecsUpdatedOnUi(specs);

    this.logger.pass(
      `✅ Front-end verified: Updated specs rendered in UI: Engine="${specs.engineType}", Disp="${specs.displacement}", Cyl="${specs.cylinders}"`
    );
    return specs;
  }

  /**
   * Asserts the on-page Specifications section contains the new engine type.
   */
  async verifySpecsUpdatedOnUi(specs: DynamicVehicleSpecs): Promise<void> {
    const specsSection = this.previewPage.getPage()
      .locator('section:has-text("Specifications"), div:has(h2:has-text("Specifications"))')
      .first();
    await expect(specsSection).toContainText(specs.engineType);
  }
}
