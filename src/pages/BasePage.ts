import { Page, Locator } from '@playwright/test';
import { SelfHealingAgent, LocatorStrategy } from '../utils/SelfHealingAgent';

/**
 * Layer 2: Abstract BasePage
 * Provides shared browser interactions, navigation, state cleanup,
 * and native autonomous self-healing locator capabilities.
 */
export abstract class BasePage {
  protected healer: SelfHealingAgent;

  constructor(protected page: Page) {
    this.healer = new SelfHealingAgent(page);
  }

  async navigate(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async getUrl(): Promise<string> {
    return this.page.url();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clearBrowserState(): Promise<void> {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      try { localStorage.clear(); } catch (_) {}
      try { sessionStorage.clear(); } catch (_) {}
    });
  }

  /**
   * Finds an element using autonomous self-healing across multiple strategies.
   */
  async healLocator(
    elementName: string,
    strategies: LocatorStrategy[],
    timeoutMs = 15_000
  ): Promise<Locator> {
    return this.healer.find(elementName, strategies, timeoutMs);
  }

  /**
   * Clicks an element using autonomous self-healing.
   */
  async healClick(
    elementName: string,
    strategies: LocatorStrategy[],
    timeoutMs = 15_000
  ): Promise<void> {
    await this.healer.click(elementName, strategies, timeoutMs);
  }

  /**
   * Fills an input using autonomous self-healing.
   */
  async healFill(
    elementName: string,
    strategies: LocatorStrategy[],
    value: string,
    timeoutMs = 15_000
  ): Promise<void> {
    await this.healer.fill(elementName, strategies, value, timeoutMs);
  }
}
