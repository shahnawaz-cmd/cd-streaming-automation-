import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { Logger } from '../../utils/Logger';

export interface CdmaGarageSummary {
  url: string;
  title: string;
  navLinks: string[];
  bodySnippet: string;
}

/**
 * Layer 2: CdmaGaragePage
 * 100% Native Playwright self-healing POM for CDMA (/members/my-garage).
 * Zero static timeouts & zero manual navigation — waits on app's own default post-auth redirect.
 */
export class CdmaGaragePage extends BasePage {
  private logger = new Logger('CdmaGaragePage');

  constructor(page: Page) {
    super(page);
  }

  searchNavLink = (): Locator =>
    this.page
      .locator('a[href="/members/search"]')
      .or(this.page.getByRole('link', { name: /^Search$/i }))
      .first();

  myGarageNavLink = (): Locator =>
    this.page
      .locator('a[href="/members/my-garage"]')
      .or(this.page.getByRole('link', { name: /^My Garage$/i }))
      .first();

  myReportsNavLink = (): Locator =>
    this.page
      .locator('a[href="/members/my-reports"]')
      .or(this.page.getByRole('link', { name: /^My Reports$/i }))
      .first();

  orderHistoryNavLink = (): Locator =>
    this.page
      .locator('a[href="/members/order-history"]')
      .or(this.page.getByRole('link', { name: /^Order History$/i }))
      .first();

  accountEmail = (email: string): Locator =>
    this.page
      .getByText(email, { exact: false })
      .or(this.page.locator('header, aside, nav').getByText(email))
      .first();

  vehicleVinBadge = (vin: string): Locator =>
    this.page
      .getByText(vin, { exact: true })
      .or(this.page.locator('main, body').getByText(vin))
      .first();

  viewVehicleDetailsBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /View vehicle details/i })
      .or(this.page.getByRole('link', { name: /View vehicle details/i }))
      .or(this.page.getByText(/View vehicle details/i))
      .first();

  getReportBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /^Get Report$/i })
      .or(this.page.getByRole('link', { name: /^Get Report$/i }))
      .first();

  getStickerBtn = (): Locator =>
    this.page
      .getByRole('button', { name: /^Get Sticker$/i })
      .or(this.page.getByRole('link', { name: /^Get Sticker$/i }))
      .first();

  /**
   * Waits natively for the system's default auto-navigation to /members/my-garage (never manually calls goto).
   */
  async waitForDefaultAutoNavigation(): Promise<void> {
    await this.page.waitForURL(/\/members\/my-garage/);
    await expect(this.myGarageNavLink()).toBeVisible();
    this.logger.pass(`Default auto-navigation landed on CDMA: ${this.page.url()}`);
  }

  /**
   * Asserts core CDMA sidebar/header navigation links and authenticated user email are visible.
   */
  async verifyCdmaNavigationAndUser(email: string): Promise<void> {
    await expect(this.searchNavLink()).toBeVisible();
    await expect(this.myGarageNavLink()).toBeVisible();
    await expect(this.myReportsNavLink()).toBeVisible();
    await expect(this.orderHistoryNavLink()).toBeVisible();
    await expect(this.accountEmail(email)).toBeVisible();
    this.logger.pass(`Verified CDMA navigation bar & logged-in user (${email})`);
  }

  /**
   * Asserts every expected VIN is persisted and rendered inside CDMA My Garage.
   */
  async verifyVehiclesSaved(vins: string[]): Promise<void> {
    for (const vin of vins) {
      await expect(this.vehicleVinBadge(vin)).toBeVisible();
    }
    await expect(this.viewVehicleDetailsBtn()).toBeVisible();
    await expect(this.getReportBtn()).toBeVisible();
    await expect(this.getStickerBtn()).toBeVisible();
    this.logger.pass(`Verified vehicle(s) persisted in CDMA My Garage: [${vins.join(', ')}]`);
  }

  /**
   * Captures structured CDMA Garage summary for JSON telemetry.
   */
  async captureGarageSummary(): Promise<CdmaGarageSummary> {
    return this.page.evaluate(() => {
      const navLinks = Array.from(document.querySelectorAll('a[href^="/members/"]'))
        .map((a) => `${(a.textContent || '').trim()} -> ${a.getAttribute('href')}`)
        .filter(Boolean);
      return {
        url: location.href,
        title: document.title,
        navLinks: Array.from(new Set(navLinks)),
        bodySnippet: (document.body.innerText || '').trim().slice(0, 800),
      };
    });
  }
}
