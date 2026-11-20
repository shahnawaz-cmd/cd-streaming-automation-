import { Browser, expect, Page } from '@playwright/test';
import { BrowserSession } from '../utils/BrowserSession';
import { HomePage, RevisitBannerSnapshot } from '../pages/home';
import { PreviewPage, PreviewType } from '../pages/preview';
import { SelectedYmmt } from '../pages/preview/EditYmmModalComponent';
import { ClassicDecodeHandler } from './ClassicDecodeHandler';
import { EditYmmModule } from './EditYmmModule';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { VinGenerator } from '../data/VinGenerator';
import { Logger } from '../utils/Logger';

export interface ModernRevisitResult {
  vin: string;
  previewType: PreviewType;
  vehicleTitle: string;
  banner: RevisitBannerSnapshot;
  landedUrl: string;
  queryParams: Record<string, string>;
}

export interface ClassicEditYmmtRevisitResult {
  vin: string;
  previewType: PreviewType;
  originalVehicleTitle: string;
  updatedYmmt: SelectedYmmt;
  updatedVehicleTitle: string;
  banner: RevisitBannerSnapshot;
  landedUrl: string;
  queryParams: Record<string, string>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Layer 3: RevisitBannerModule
 * Validates Revisit Banner persistence & navigation across:
 * 1. Modern VIN decode (vhr / sticker) -> Home Revisit Banner -> Grab CTA -> Preview (content=revisitingBanner)
 * 2. New isolated session Classic Mapped VIN -> Edit YMMT -> Home Revisit Banner (updated YMMT) -> Grab CTA -> Preview
 */
export class RevisitBannerModule {
  private logger = new Logger('RevisitBannerModule');

  constructor(
    private browser: Browser,
    private page: Page,
    private previewPage: PreviewPage,
    private homePage: HomePage,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  private assertRevisitLandingUrl(
    landedUrl: string,
    expectedVin: string,
    expectedType: PreviewType
  ): Record<string, string> {
    const parsed = new URL(landedUrl);
    const queryParams = Object.fromEntries(parsed.searchParams.entries());

    expect(queryParams.vin, 'Revisit landed Preview URL should preserve vin').toBe(expectedVin);
    expect(queryParams.type, 'Revisit landed Preview URL should preserve type').toBe(expectedType);
    expect(queryParams.content, 'Revisit landed Preview URL must carry content=revisitingBanner').toBe(
      'revisitingBanner'
    );
    return queryParams;
  }

  /**
   * Flow 1: Decodes a fresh MongoDB Modern VIN cleanly on Preview (vhr or sticker),
   * returns to Homepage '/', asserts the Revisit Banner matches type & VIN, clicks Grab,
   * and verifies landed Preview URL carries type & content=revisitingBanner.
   */
  async verifyModernRevisitBanner(): Promise<ModernRevisitResult> {
    const previewType: PreviewType = Math.random() < 0.5 ? 'vhr' : 'sticker';
    const decodedVin = await this.previewCheckoutModule.openFreshModernVin(previewType);

    await expect(this.previewPage.header.packageAccessCta()).toBeEnabled();
    const vehicleTitle = await this.previewPage.getVehicleTitle();

    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    const banner = await this.homePage.revisitBanner.waitForBanner();

    expect(banner.messageText, 'Modern Revisit Banner should include decoded VIN').toContain(decodedVin);
    const expectedProductPattern = previewType === 'vhr' ? /report/i : /build\s*sheet/i;
    expect(
      banner.messageText,
      `Modern Revisit Banner should reflect type=${previewType}`
    ).toMatch(expectedProductPattern);

    const landedUrl = await this.homePage.revisitBanner.clickGrabAndWaitForPreview();
    const queryParams = this.assertRevisitLandingUrl(landedUrl, decodedVin, previewType);

    return {
      vin: decodedVin,
      previewType,
      vehicleTitle,
      banner,
      landedUrl,
      queryParams,
    };
  }

  /**
   * Flow 2: Opens an isolated fresh browser session, decodes a Classic Mapped VIN,
   * updates YMMT dynamically, returns to Homepage '/', verifies the Revisit Banner shows
   * the updated YMMT, clicks Grab, and verifies content=revisitingBanner in Preview URL.
   */
  async verifyClassicEditYmmtRevisitBanner(): Promise<ClassicEditYmmtRevisitResult> {
    const context = await BrowserSession.newContext(this.browser);

    try {
      const classicPage = await context.newPage();
      const classicPreview = new PreviewPage(classicPage);
      const classicHome = new HomePage(classicPage);
      const classicDecodeHandler = new ClassicDecodeHandler(classicPreview);
      const editYmmModule = new EditYmmModule(classicPreview);

      const previewType: PreviewType = 'vhr';
      const classicVin = VinGenerator.classicMapped();
      await classicPreview.openDirectly(classicVin, previewType);
      await classicDecodeHandler.requireDecodedOrSkip(classicVin);
      this.logger.pass(`Decoded Classic VIN ${classicVin} in new session`);

      const originalVehicleTitle = await classicPreview.getVehicleTitle();
      const updatedYmmt = await editYmmModule.updateDynamicYmmt();

      await classicPreview.editYmm.modal().waitFor({ state: 'hidden' });
      await expect(classicPage).toHaveURL(/[?&]q=/);
      await expect(classicPreview.header.vehicleTitle()).toContainText(
        new RegExp(escapeRegExp(updatedYmmt.make), 'i')
      );
      await expect(classicPreview.header.vehicleTitle()).toContainText(
        new RegExp(escapeRegExp(updatedYmmt.model), 'i')
      );
      const updatedVehicleTitle = await classicPreview.getVehicleTitle();

      await classicPage.goto('/', { waitUntil: 'domcontentloaded' });
      const banner = await classicHome.revisitBanner.waitForBanner();

      expect(banner.messageText, 'Classic Revisit Banner should include VIN').toContain(classicVin);
      expect(banner.messageText, 'Classic Revisit Banner should include updated Year').toContain(updatedYmmt.year);
      expect(banner.messageText, 'Classic Revisit Banner should include updated Make').toMatch(
        new RegExp(escapeRegExp(updatedYmmt.make), 'i')
      );
      expect(banner.messageText, 'Classic Revisit Banner should include updated Model').toMatch(
        new RegExp(escapeRegExp(updatedYmmt.model), 'i')
      );

      const landedUrl = await classicHome.revisitBanner.clickGrabAndWaitForPreview();
      const queryParams = this.assertRevisitLandingUrl(landedUrl, classicVin, previewType);

      return {
        vin: classicVin,
        previewType,
        originalVehicleTitle,
        updatedYmmt,
        updatedVehicleTitle,
        banner,
        landedUrl,
        queryParams,
      };
    } finally {
      await context.close();
    }
  }
}
