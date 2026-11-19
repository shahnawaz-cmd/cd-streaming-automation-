import { expect, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import type { EvidenceModule } from './EvidenceModule';
import { Logger } from '../utils/Logger';

export interface ShortVinValidationResult {
  vin: string;
  length: number;
  url: string;
  headingText: string;
  statusBannerText: string;
  searchFormReady: boolean;
  ctaDisabled: boolean;
}

/**
 * Layer 3: ShortVinHandler
 * Validates direct Preview URL behavior when given a malformed short VIN (< 5 chars).
 * Zero static timeouts — relies strictly on native Playwright web-first assertions.
 */
export class ShortVinHandler {
  private logger = new Logger('ShortVinHandler');

  constructor(
    private previewPage: PreviewPage,
    private evidenceModule: EvidenceModule
  ) {}

  /**
   * Asserts short VIN rejection banner, recovery search form, purchase-guard status,
   * and disabled Checkout CTA.
   */
  async verifyShortVinRejected(vin: string): Promise<ShortVinValidationResult> {
    const page = this.previewPage.getPage();
    const shortErr = this.previewPage.shortVinError;

    await expect(page).toHaveURL(new RegExp(`/preview\\?.*vin=${vin}(?:&|$)`));
    await expect(shortErr.heading()).toBeVisible();
    await expect(shortErr.subtext()).toBeVisible();
    await expect(shortErr.checkedVinBadge(vin)).toBeVisible();
    await expect(shortErr.searchInput()).toBeVisible();
    await expect(shortErr.searchBtn()).toBeEnabled();
    await expect(shortErr.noPurchaseStatusBanner()).toBeVisible();

    const cta = this.previewPage.header.packageAccessCta();
    await expect(cta).toBeVisible();
    await expect(cta).toBeDisabled();

    const headingText = (await shortErr.heading().textContent())?.trim() || '';
    const statusBannerText = (await shortErr.noPurchaseStatusBanner().textContent())?.trim() || '';

    this.logger.pass(
      `Short VIN "${vin}" (len=${vin.length}) rejected cleanly: "${headingText}" | CTA disabled | Status: "${statusBannerText}"`
    );

    return {
      vin,
      length: vin.length,
      url: page.url(),
      headingText,
      statusBannerText,
      searchFormReady: true,
      ctaDisabled: true,
    };
  }

  /**
   * Validates short VIN rejection and attaches element screenshot + JSON telemetry proof.
   */
  async verifyAndRecordProof(testInfo: TestInfo, vin: string): Promise<ShortVinValidationResult> {
    const result = await this.verifyShortVinRejected(vin);
    await this.evidenceModule.recordShortVinErrorProof(testInfo, this.previewPage, result);
    return result;
  }
}
