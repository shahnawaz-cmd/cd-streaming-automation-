import { Browser, expect, Page } from '@playwright/test';
import { HomePage } from '../pages/home';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { VinGenerator } from '../data/VinGenerator';
import { BrowserSession } from '../utils/BrowserSession';
import { Logger } from '../utils/Logger';

const UTM = {
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'summer_promo',
  utm_content: 'vhr_test',
  utm_term: 'classic_cars',
} as const;

const GOOGLE_REFERER = 'https://www.google.com/search?q=vin+check';

/** Cookie formats written by Preview: `key-value` pairs joined by `--` (utm_content / utm_term are dropped). */
const EXPECTED_UTM_DETAILS = `utm_source-${UTM.utm_source}--utm_campaign-${UTM.utm_campaign}--utm_medium-${UTM.utm_medium}`;
const EXPECTED_REFERRER = 'referrer-google.com--source-Google--query-';

export interface TrackingCookieResult {
  scenario: 'UTM_LANDING' | 'GOOGLE_REFERRER_ONLY';
  landingUrl: string;
  referer: string;
  utm_details: string | null;
  referrer: string | null;
}

/**
 * Layer 3: TrackingCookieModule
 * Verifies the first-party attribution cookies written on landing:
 * - `utm_details` when Preview is opened with UTM params (takes precedence over referrer)
 * - `referrer` when the base URL is opened from Google without UTM params
 * Each scenario runs in an isolated fresh session so no cookie can leak between them.
 */
export class TrackingCookieModule {
  private logger = new Logger('TrackingCookieModule');

  constructor(private browser: Browser) {}

  private async readCookie(page: Page, name: string): Promise<string | null> {
    const cookie = (await page.context().cookies()).find((c) => c.name === name);
    return cookie ? decodeURIComponent(cookie.value) : null;
  }

  /** UTM params on Preview (from Google): `utm_details` is written and the `referrer` cookie is suppressed. */
  verifyUtmCookie(): Promise<TrackingCookieResult> {
    return BrowserSession.withPage(this.browser, async (page) => {
      const vin = await VinGenerator.modernFromMongo();
      await new PreviewPage(page).openWithTracking(vin, UTM, GOOGLE_REFERER);

      await expect
        .poll(() => this.readCookie(page, 'utm_details'), { message: 'utm_details cookie' })
        .toBe(EXPECTED_UTM_DETAILS);
      expect(await this.readCookie(page, 'referrer'), 'referrer cookie must be absent when UTMs are present').toBeNull();

      this.logger.pass(`utm_details=${EXPECTED_UTM_DETAILS}`);
      return {
        scenario: 'UTM_LANDING',
        landingUrl: page.url(),
        referer: GOOGLE_REFERER,
        utm_details: await this.readCookie(page, 'utm_details'),
        referrer: null,
      };
    });
  }

  /** Landing on the base URL from Google (no UTMs): `referrer` is written and no `utm_details` cookie exists. */
  verifyReferrerCookie(): Promise<TrackingCookieResult> {
    return BrowserSession.withPage(this.browser, async (page) => {
      await new HomePage(page).openFromReferrer(GOOGLE_REFERER);

      await expect
        .poll(() => this.readCookie(page, 'referrer'), { message: 'referrer cookie' })
        .toBe(EXPECTED_REFERRER);
      expect(await this.readCookie(page, 'utm_details'), 'utm_details cookie must be absent without UTMs').toBeNull();

      this.logger.pass(`referrer=${EXPECTED_REFERRER}`);
      return {
        scenario: 'GOOGLE_REFERRER_ONLY',
        landingUrl: page.url(),
        referer: GOOGLE_REFERER,
        utm_details: null,
        referrer: await this.readCookie(page, 'referrer'),
      };
    });
  }
}
