import { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { HomeHeroComponent } from './HomeHeroComponent';
import { HomeExitIntentComponent } from './HomeExitIntentComponent';
import { HomeTrackingHelper, UtmParams } from './HomeTrackingHelper';
import { HomeTrustComponent } from './HomeTrustComponent';
import { HomeNavComponent } from './HomeNavComponent';
import { RevisitBannerComponent } from './RevisitBannerComponent';

/**
 * HomePage (Unified Modular Page Object)
 * Composes focused sub-components to eliminate monolithic locator clutter.
 */
export class HomePage extends BasePage {
  // Modular Sub-Components
  readonly hero: HomeHeroComponent;
  readonly exitIntent: HomeExitIntentComponent;
  readonly tracking: HomeTrackingHelper;
  readonly trust: HomeTrustComponent;
  readonly nav: HomeNavComponent;
  readonly revisitBanner: RevisitBannerComponent;

  constructor(page: Page) {
    super(page);
    this.hero = new HomeHeroComponent(page);
    this.exitIntent = new HomeExitIntentComponent(page);
    this.tracking = new HomeTrackingHelper(page);
    this.trust = new HomeTrustComponent(page);
    this.nav = new HomeNavComponent(page);
    this.revisitBanner = new RevisitBannerComponent(page);
  }

  // Navigation
  async open(): Promise<void> {
    await this.navigate('/');
    await this.hero.vinInput().waitFor({ state: 'visible', timeout: 15_000 });
    // Stable hydration window for Next.js
    await this.page.waitForTimeout(1500);
  }

  /** Opens the base URL with a coupon applied via the `offer` query parameter (e.g. `/?offer=get20`). */
  async openWithOffer(offer: string): Promise<void> {
    await this.navigate(`/?${new URLSearchParams({ offer })}`);
    await this.hero.vinInput().waitFor({ state: 'visible' });
  }

  /** Opens the base URL as if arriving from an external site (sets the HTTP referrer). */
  async openFromReferrer(referer: string): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded', referer });
    await this.hero.vinInput().waitFor({ state: 'visible' });
  }

  // Delegated conveniences for backward compatibility
  vinInput = (): Locator => this.hero.vinInput();
  submitBtn = (): Locator => this.hero.submitBtn();
  heroHeading = (): Locator => this.hero.heroHeading();

  async fillVin(vin: string): Promise<void> {
    await this.hero.fillVin(vin);
  }

  async clickSubmit(): Promise<void> {
    await this.hero.clickSubmit();
  }

  async waitForPreviewRedirect(vin: string, timeout = 30_000): Promise<void> {
    await this.hero.waitForPreviewRedirect(vin, timeout);
  }
}

export { UtmParams };
