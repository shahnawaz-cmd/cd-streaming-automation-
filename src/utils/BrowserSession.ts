import { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';
import { ENV } from '../config/env';

/**
 * Layer 5: BrowserSession
 * Single source for isolated "new session" browser contexts, mirroring playwright.config `use`
 * settings plus the bot-fingerprint strip. Callers own the context lifecycle (close in finally).
 */
export class BrowserSession {
  /** Init script masking navigator.webdriver (shared by fixtures and isolated contexts). */
  static readonly stripWebdriver = (): void => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  };

  static async newContext(browser: Browser, options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const context = await browser.newContext({
      baseURL: ENV.baseURL,
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ...options,
    });
    await context.addInitScript(BrowserSession.stripWebdriver);
    return context;
  }
}
