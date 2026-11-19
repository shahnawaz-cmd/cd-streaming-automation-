import { Page, Locator } from '@playwright/test';

/**
 * HomeTrustComponent
 * Encapsulates trust badges, Sample Report links, Trustpilot widget, and App store links.
 */
export class HomeTrustComponent {
  constructor(private page: Page) {}

  viewSampleReportLink = (): Locator =>
    this.page.locator('a:has-text("View Sample")').first();

  whereToFindVinBtn = (): Locator =>
    this.page.locator('button:has-text("Where to find classic VIN")').first();

  prepaidCreditsLink = (): Locator =>
    this.page.locator('a:has-text("No VIN? Get prepaid credits"), a[href*="/pricing"]').first();

  trustpilotWidget = (): Locator =>
    this.page.locator('a[href*="trustpilot.com"]').first();

  appStoreBadge = (): Locator =>
    this.page.locator('a[href*="apple.com"]').first();

  googlePlayBadge = (): Locator =>
    this.page.locator('a[href*="google.com"]').first();

  valuePropsList = (): Locator =>
    this.page.locator('text=/Decode 5–14 Digit Classic VINs|Get a Classic Vehicle History Report/i');
}
