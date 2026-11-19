import { Page } from '@playwright/test';

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  ref?: string;
  coupon?: string;
}

/**
 * HomeTrackingHelper
 * Encapsulates Referral tags, UTM campaign tracking, and coupon parameter handling.
 */
export class HomeTrackingHelper {
  constructor(private page: Page) {}

  /**
   * Opens the Homepage with custom tracking parameters appended
   */
  async openWith(params: UtmParams = {}): Promise<void> {
    const searchParams = new URLSearchParams();
    if (params.source) searchParams.set('utm_source', params.source);
    if (params.medium) searchParams.set('utm_medium', params.medium);
    if (params.campaign) searchParams.set('utm_campaign', params.campaign);
    if (params.ref) searchParams.set('ref', params.ref);
    if (params.coupon) searchParams.set('coupon', params.coupon);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    await this.page.goto(`/${query}`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1500);
  }

  /**
   * Extracts stored tracking tokens and cookies persisted on client side
   */
  async getStoredTracking(): Promise<{ ref?: string; utm?: string; coupon?: string }> {
    return this.page.evaluate(() => {
      const matchCoupon = document.cookie.match(/coupon=([^;]+)/);
      const matchRef = document.cookie.match(/ref=([^;]+)/);
      return {
        ref: matchRef?.[1] || localStorage.getItem('ref') || undefined,
        utm: localStorage.getItem('utm_params') || undefined,
        coupon: matchCoupon?.[1] || localStorage.getItem('applied_coupon') || undefined,
      };
    });
  }
}
