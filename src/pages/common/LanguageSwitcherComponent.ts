import { Page, Locator, expect } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import { SupportedLocale, LocaleDictionary } from '../../data/LocaleDictionary';

/**
 * Layer 2: LanguageSwitcherComponent
 * POM for the header Globe Language Switcher dropdown.
 * Zero static timeouts — strictly web-first Playwright assertions after React/Radix hydration.
 */
export class LanguageSwitcherComponent {
  private logger = new Logger('LanguageSwitcherComponent');

  constructor(private page: Page) {}

  globeTrigger = (): Locator =>
    this.page
      .locator('button[aria-haspopup="menu"]:has(svg.lucide-globe)')
      .or(this.page.locator('header button[aria-haspopup="menu"]').filter({ hasText: /^(EN|ES|FR|DE|SV)$/i }))
      .or(this.page.getByRole('banner').getByRole('button', { name: /^(EN|ES|FR|DE|SV)$/i }))
      .first();

  menu = (): Locator =>
    this.page
      .getByRole('menu')
      .or(this.page.locator('[data-radix-menu-content]'))
      .first();

  radioOptions = (): Locator =>
    this.menu()
      .getByRole('menuitemradio')
      .or(this.menu().getByRole('menuitem'));

  inactiveOptions = (): Locator =>
    this.menu()
      .locator('[role="menuitemradio"][aria-checked="false"]')
      .or(this.menu().locator('[role="menuitem"][aria-checked="false"]'));

  /**
   * Navigates to homepage, waits for full hydration, and opens the Globe language menu natively.
   */
  async openOnHomepage(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'networkidle' });
    await expect(this.globeTrigger()).toBeVisible();

    await expect(async () => {
      const trigger = this.globeTrigger();
      const menuVisible = await this.menu().isVisible();
      if (!menuVisible && (await trigger.getAttribute('aria-expanded')) !== 'true') {
        await trigger.click();
      }
      expect(await this.menu().isVisible()).toBe(true);
    }).toPass();

    await expect(this.inactiveOptions().first()).toBeVisible();
  }

  /**
   * Dynamically reads available inactive languages from the open DOM menu, picks one at random,
   * clicks it natively, and asserts URL, <html lang>, and trigger badge update.
   */
  async selectRandomLanguage(): Promise<SupportedLocale> {
    await this.openOnHomepage();

    const options = this.inactiveOptions();
    const count = await options.count();
    expect(count, 'Expected at least one non-active language option in switcher menu').toBeGreaterThan(0);

    const randomIndex = Math.floor(Math.random() * count);
    const chosenOption = options.nth(randomIndex);
    const labelText = (await chosenOption.innerText()).trim();
    const code = LocaleDictionary.parseCodeFromMenuText(labelText);
    if (!code) {
      throw new Error(`[LanguageSwitcherComponent] Could not parse locale code from menu item: "${labelText}"`);
    }

    const locale = LocaleDictionary.getByCode(code);
    await chosenOption.click();

    await expect(this.page).toHaveURL(new RegExp(`/${locale.code}(?:\\?|/|$)`));
    await expect(this.page.locator('html')).toHaveAttribute('lang', locale.code);
    await expect(this.globeTrigger()).toContainText(locale.code.toUpperCase());

    this.logger.pass(`Dynamically selected language: ${locale.label} -> ${this.page.url()}`);
    return locale;
  }
}
