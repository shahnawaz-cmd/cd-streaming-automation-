import { Page, Locator } from '@playwright/test';

/**
 * AuctionHistoryComponent
 * Encapsulates Auction & Sales History cards, records count, and bid values.
 */
export class AuctionHistoryComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page.locator('[data-testid="auction-history"], section:has-text("Auction")').first();

  recordCards = (): Locator =>
    this.page.locator('[data-testid="auction-record"], .auction-card');

  odometerReading = (): Locator =>
    this.page.locator('[data-testid="auction-odometer"], .odometer-text').first();

  titleBrandBadge = (): Locator =>
    this.page.locator('[data-testid="title-brand"], .salvage-badge').first();
}
