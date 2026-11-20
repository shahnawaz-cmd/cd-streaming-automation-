import { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test';
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

  /** Runs `action` on a page in a brand-new isolated session and always closes the context. */
  static async withPage<T>(
    browser: Browser,
    action: (page: Page) => Promise<T>,
    options: BrowserContextOptions = {}
  ): Promise<T> {
    const context = await BrowserSession.newContext(browser, options);
    try {
      return await action(await context.newPage());
    } finally {
      await context.close();
    }
  }
}
