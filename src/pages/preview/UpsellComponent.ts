import { expect, Locator, Page } from '@playwright/test';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';
import { PriceParser } from '../../utils/PriceParser';
import { Logger } from '../../utils/Logger';

export interface UpsellSnapshot {
  title: string;
  description: string;
  activePriceRaw: string;
  activePriceAmount: number;
  currencyToken: string;
  gifSrc: string;
  gifAbsSrc: string;
  naturalWidth: number;
  naturalHeight: number;
  checked: boolean;
}

/**
 * Layer 2: UpsellComponent
 * 100% Native Playwright self-healing POM for the Preview Upsell checkbox card, copy, price & GIF.
 * Zero static timeouts & zero hardcoded currency signs.
 */
export class UpsellComponent {
  private logger = new Logger('UpsellComponent');

  constructor(private page: Page) {}

  packageSection = (): Locator =>
    this.page
      .locator('section:has(input[type="email"])')
      .or(this.page.locator('[aria-label="Choose Package"]'))
      .or(this.page.locator('section:has([role="radiogroup"])'))
      .first();

  card = (): Locator =>
    this.packageSection()
      .locator('label:has(input[type="checkbox"])')
      .or(this.page.locator('label:has(input[type="checkbox"])'))
      .first();

  checkbox = (): Locator =>
    this.card()
      .locator('input[type="checkbox"]')
      .or(this.packageSection().getByRole('checkbox'))
      .first();

  title = (): Locator =>
    this.card()
      .locator('span.row-start-1.font-semibold')
      .or(this.card().locator('span:not([aria-hidden="true"])').first())
      .first();

  description = (): Locator =>
    this.card()
      .locator('span.row-start-2')
      .or(this.card().locator('span:not([aria-hidden="true"])').nth(1))
      .first();

  activePrice = (): Locator =>
    this.card()
      .locator('span.row-start-3 span.font-bold')
      .or(this.card().locator('span:has(> s)'))
      .or(this.card().locator('span.font-bold'))
      .first();

  gifImage = (): Locator =>
    this.card()
      .locator('img[src*="/upsell/"]')
      .or(this.card().locator('img[src$=".gif"]'))
      .or(this.card().locator('img'))
      .first();

  /**
   * Waits natively for the upsell card and its GIF image to be visible and fully decoded.
   */
  async waitForReady(): Promise<void> {
    await expect(this.card()).toBeVisible();
    await expect(this.gifImage()).toBeVisible();
    await expect(async () => {
      const dims = await this.gifImage().evaluate((el) => {
        const img = el as HTMLImageElement;
        return { complete: img.complete, naturalWidth: img.naturalWidth };
      });
      expect(dims.complete && dims.naturalWidth > 0).toBe(true);
    }).toPass();
  }

  /**
   * Captures current upsell heading, description, active (non-strikethrough) price, GIF metadata & checked state.
   */
  async readSnapshot(): Promise<UpsellSnapshot> {
    await this.waitForReady();

    const title = (await this.title().innerText()).replace(/\s+/g, ' ').trim();
    const description = (await this.description().innerText()).replace(/\s+/g, ' ').trim();

    const activePriceRaw = await this.activePrice().evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('s, del').forEach((n) => n.remove());
      return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    });
    const parsedPrice = PriceParser.parsePrice(activePriceRaw);

    const gifMeta = await this.gifImage().evaluate((el) => {
      const img = el as HTMLImageElement;
      return {
        gifSrc: img.getAttribute('src') || '',
        gifAbsSrc: img.src || '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    });

    const checked = await this.checkbox().isChecked();

    this.logger.info(
      `Upsell snapshot: title="${title}" | price=${activePriceRaw} (${parsedPrice.amount} "${parsedPrice.currencyToken}") | gif=${gifMeta.gifSrc} (${gifMeta.naturalWidth}x${gifMeta.naturalHeight})`
    );

    return {
      title,
      description,
      activePriceRaw,
      activePriceAmount: parsedPrice.amount,
      currencyToken: parsedPrice.currencyToken,
      ...gifMeta,
      checked,
    };
  }

  /**
   * Toggles the upsell checkbox ON via its wrapping label (safe from Exit-Intent overlay).
   */
  async toggleOn(): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      await expect(this.card()).toBeVisible();
      if (!(await this.checkbox().isChecked())) {
        await this.title().or(this.card()).first().click();
      }
      await expect(this.checkbox()).toBeChecked();
    });
  }

  /**
   * Toggles the upsell checkbox OFF via its wrapping label (safe from Exit-Intent overlay).
   */
  async toggleOff(): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      await expect(this.card()).toBeVisible();
      if (await this.checkbox().isChecked()) {
        await this.title().or(this.card()).first().click();
      }
      await expect(this.checkbox()).not.toBeChecked();
    });
  }
}
