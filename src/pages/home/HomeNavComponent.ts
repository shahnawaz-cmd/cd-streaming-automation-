import { Page, Locator } from '@playwright/test';

/**
 * HomeNavComponent
 * Encapsulates Homepage header navigation, Login button, and Language switcher.
 */
export class HomeNavComponent {
  constructor(private page: Page) {}

  loginBtn = (): Locator =>
    this.page.getByRole('button', { name: /Login/i }).first();

  languageSwitcher = (): Locator =>
    this.page.locator('button:has-text("EN"), [data-testid="lang-switcher"]').first();

  navPricing = (): Locator =>
    this.page.locator('menuitem:has-text("Pricing"), a:has-text("Pricing")').first();

  navBuildSheet = (): Locator =>
    this.page.locator('menuitem:has-text("Build Sheet"), a:has-text("Build Sheet")').first();

  navHistoryReport = (): Locator =>
    this.page.locator('menuitem:has-text("History Report"), a:has-text("History Report")').first();
}
