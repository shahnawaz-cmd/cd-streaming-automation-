import { Page, TestInfo } from '@playwright/test';
import { HomePage } from '../pages/home';
import { PreviewPage, PreviewType } from '../pages/preview';
import { ClassicDecodeHandler } from './ClassicDecodeHandler';
import { EvidenceModule } from './EvidenceModule';
import { VinGenerator } from '../data/VinGenerator';
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
    private previewPage: PreviewPage,
    private classicDecodeHandler: ClassicDecodeHandler,
    private evidenceModule: EvidenceModule
  ) {}

  async decodeFromHomepage(vin: string): Promise<void> {
    this.logger.step(`Enter VIN and submit on Homepage: ${vin}`);
    await this.homePage.open();
    await this.homePage.fillVin(vin);
    await this.homePage.clickSubmit();
    await this.homePage.waitForPreviewRedirect(vin);
    this.logger.pass(`Successfully redirected to preview for VIN: ${vin}`);
  }

  async decodeClassicMappedWithProof(testInfo: TestInfo): Promise<string> {
    let vin = VinGenerator.classicMapped();
    while (true) {
      await this.decodeFromHomepage(vin);
      const outcome = await this.classicDecodeHandler.verifyOutcome(60_000);
      if (outcome === 'DECODED') break;
      vin = VinGenerator.classicMapped();
    }
    await this.evidenceModule.recordOriginalSpecsProof(testInfo, this.previewPage, vin);
    return vin;
  }

  async submitVinOnCurrentPage(vin: string): Promise<void> {
    this.logger.step(`Enter VIN on current page: ${vin}`);
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
