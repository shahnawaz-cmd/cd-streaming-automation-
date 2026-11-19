import { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { HomeHeroComponent } from './HomeHeroComponent';
import { HomeExitIntentComponent } from './HomeExitIntentComponent';
import { HomeTrackingHelper, UtmParams } from './HomeTrackingHelper';
import { HomeTrustComponent } from './HomeTrustComponent';
import { HomeNavComponent } from './HomeNavComponent';

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

  constructor(page: Page) {
    super(page);
    this.hero = new HomeHeroComponent(page);
    this.exitIntent = new HomeExitIntentComponent(page);
    this.tracking = new HomeTrackingHelper(page);
    this.trust = new HomeTrustComponent(page);
    this.nav = new HomeNavComponent(page);
  }

  // Navigation
  async open(): Promise<void> {
    await this.navigate('/');
    await this.hero.vinInput().waitFor({ state: 'visible', timeout: 15_000 });
    // Stable hydration window for Next.js
    await this.page.waitForTimeout(1500);
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
