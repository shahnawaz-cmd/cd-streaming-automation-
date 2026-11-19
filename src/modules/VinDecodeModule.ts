import { Page } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { PreviewPage, PreviewType } from '../pages/PreviewPage';
import { Logger } from '../utils/Logger';

/**
 * Layer 3: VinDecodeModule
 * Orchestrates business workflows across HomePage and PreviewPage.
 * Does not contain raw selectors or assertions.
 */
export class VinDecodeModule {
  private logger = new Logger('VinDecodeModule');

  constructor(
    private page: Page,
    private homePage: HomePage,
    private previewPage: PreviewPage
  ) {}

  async decodeFromHomepage(vin: string): Promise<void> {
    this.logger.step(`Enter VIN and submit on Homepage: ${vin}`);
    await this.homePage.open();
    await this.homePage.fillVin(vin);
    await this.homePage.clickSubmit();
    await this.homePage.waitForPreviewRedirect(vin);
    this.logger.pass(`Successfully redirected to preview for VIN: ${vin}`);
  }

  async decodeDirectly(vin: string, type: PreviewType = 'vhr'): Promise<void> {
    this.logger.step(`Navigate directly to Preview for VIN: ${vin} (type: ${type})`);
    await this.previewPage.openDirectly(vin, type);
  }
}
