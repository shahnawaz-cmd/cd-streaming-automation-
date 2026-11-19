import { Page } from '@playwright/test';
import { Logger } from '../utils/Logger';

export type CheckoutFlowType = 'streaming' | 'non_streaming';

/**
 * Layer 3: FlowDetectionModule
 * Inspects client state and cookies to determine the active checkout flow.
 */
export class FlowDetectionModule {
  private logger = new Logger('FlowDetectionModule');

  constructor(private page: Page) {}

  async detectFlow(): Promise<CheckoutFlowType> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    const flow = await this.page.evaluate(() => {
      const siteSettings = localStorage.getItem('site_settings');
      if (siteSettings) {
        try {
          const parsed = JSON.parse(siteSettings);
          if (parsed.checkout_flow) return parsed.checkout_flow;
        } catch (_) {}
      }
      const match = document.cookie.match(/checkout_flow=([^;]+)/);
      if (match) return match[1];
      return 'streaming';
    });
    this.logger.info(`Detected checkout flow: ${flow}`);
    return flow === 'non_streaming' ? 'non_streaming' : 'streaming';
  }
}
