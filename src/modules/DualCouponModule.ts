import { Page } from '@playwright/test';
import { HomePage } from '../pages/home';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { ExitIntentModule } from './ExitIntentModule';
import { Logger } from '../utils/Logger';

export interface DualCouponResult {
  homeOffer: string;
  vin: string;
  previewUrl: string;
  couponCookie: string | null;
  previewCtaBeforeExitIntent: string;
  exitIntentHeading: string;
}

/**
 * Layer 3: DualCouponModule
 * A coupon is applied on the base URL (`/?offer=<code>`), the VIN is decoded through the Homepage,
 * and on Preview the exit-intent banner (a second coupon offer) must still trigger.
 */
export class DualCouponModule {
  private logger = new Logger('DualCouponModule');

  constructor(
    private page: Page,
    private homePage: HomePage,
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule,
    private exitIntentModule: ExitIntentModule
  ) {}

  async verifyExitIntentWithHomeCoupon(homeOffer = 'get20'): Promise<DualCouponResult> {
    const vin = await this.previewCheckoutModule.decodeFreshModernVin(async (candidate) => {
      await this.homePage.openWithOffer(homeOffer);
      await this.homePage.fillVin(candidate);
      await this.homePage.clickSubmit();
      await this.homePage.waitForPreviewRedirect(candidate);
    });

    const couponCookie = (await this.page.context().cookies()).find((c) => c.name === 'coupon')?.value ?? null;
    const previewCtaBeforeExitIntent = (await this.previewPage.header.packageAccessCta().innerText())
      .replace(/\s+/g, ' ')
      .trim();

    await this.exitIntentModule.triggerPopup();
    const exitIntentHeading = (await this.previewPage.exitIntent.heading().innerText()).replace(/\s+/g, ' ').trim();

    this.logger.pass(`Exit-intent banner triggered on Preview with home coupon "${homeOffer}": "${exitIntentHeading}"`);
    return {
      homeOffer,
      vin,
      previewUrl: this.page.url(),
      couponCookie,
      previewCtaBeforeExitIntent,
      exitIntentHeading,
    };
  }
}
