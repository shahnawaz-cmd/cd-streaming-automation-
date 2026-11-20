import { expect, Locator, Page } from '@playwright/test';
import { PriceParser } from '../../utils/PriceParser';

export type PricingMode = 'report' | 'sticker';

export interface PlanCardSnapshot {
  name: string;
  /** Final per-unit price shown on the card (discounted when a coupon is active). */
  unitPrice: number;
  /** Final total shown on the card (discounted when a coupon is active). */
  totalPrice: number;
  currencyToken: string;
}

const TOTAL_ROW = /^Total\s*:?/i;
const GET_CTA = /^Get\s+\S+/i;

/**
 * PricingPlansComponent
 * Credit plan cards and the Vehicle History Report <-> Build Sheet toggle.
 * Native `.or()` self-healing cascades (role -> text -> structural CSS).
 */
export class PricingPlansComponent {
  constructor(private page: Page) {}

  /**
   * Credit plan cards of the active mode: the innermost block holding both a "Total:" row and a CTA button.
   * Excludes the subscription card and every wrapping container.
   */
  cards = (): Locator => {
    const withTotalAndCta = (root: Locator): Locator =>
      root
        .locator('div')
        .filter({ hasText: /Total\s*:/i })
        .filter({ has: this.page.getByRole('button') });
    return withTotalAndCta(this.page.locator('main')).filter({ hasNot: withTotalAndCta(this.page.locator(':scope')) });
  };

  /** The plan card whose header matches `name` (e.g. "1 Credit"). */
  card = (name: string): Locator =>
    this.cards()
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\b`, 'i') })
      .first();

  getButton = (name: string): Locator =>
    this.card(name)
      .getByRole('button', { name: GET_CTA })
      .or(this.card(name).locator('button:has-text("Get")'))
      .first();

  /** Vehicle History Report <-> Build Sheet toggle. */
  modeSwitch = (): Locator =>
    this.page
      .getByRole('switch')
      .or(this.page.locator('button[role="switch"]'))
      .or(this.page.locator('main [aria-checked][data-state]'))
      .first();

  /** Flips the toggle (if needed) and waits until the plan cards re-render for the chosen mode. */
  async selectMode(mode: PricingMode): Promise<void> {
    const wantChecked = String(mode === 'sticker');
    const toggle = this.modeSwitch();
    if ((await toggle.getAttribute('aria-checked')) === wantChecked) return;
    const before = await this.cards().allInnerTexts();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', wantChecked);
    await expect
      .poll(() => this.cards().allInnerTexts(), { message: `plan cards switch to ${mode} mode` })
      .not.toEqual(before);
  }

  /**
   * Reads every plan card (name, final unit price, final total) in whatever currency the location resolves to.
   * Prices are parsed one UI line at a time ("$12", "$9.6"), which keeps struck-through and discounted
   * amounts separate; the last price of each section is the amount actually charged.
   */
  async read(): Promise<PlanCardSnapshot[]> {
    await expect(this.cards().first()).toBeVisible();
    const texts = await this.cards().allInnerTexts();
    return texts.map((text) => {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const totalAt = lines.findIndex((l) => TOTAL_ROW.test(l));
      const unit = pricesIn(totalAt < 0 ? lines : lines.slice(0, totalAt + 1));
      const total = pricesIn(totalAt < 0 ? [] : lines.slice(totalAt));
      if (!unit.length || !total.length) {
        throw new Error(`[PricingPlansComponent] Could not read prices from plan card: "${lines.join(' | ')}"`);
      }
      const finalTotal = total[total.length - 1];
      return {
        name: lines[0],
        unitPrice: unit[unit.length - 1].amount,
        totalPrice: finalTotal.amount,
        currencyToken: finalTotal.currencyToken,
      };
    });
  }
}

/** Currency-tagged prices found on individual UI lines; counts ("10 Credits"), "Saved 68%" and labels are skipped. */
function pricesIn(lines: string[]) {
  return lines.flatMap((line) => {
    const price = PriceParser.tryParseCurrencyLine(line);
    return price ? [price] : [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
