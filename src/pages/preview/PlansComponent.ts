import { expect, Page, Locator } from '@playwright/test';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';
import { PriceParser } from '../../utils/PriceParser';
import { Logger } from '../../utils/Logger';

export interface PlanOptionInfo {
  index: number;
  label: string;
  count: number;
  totalRaw: string;
  totalAmount: number;
  currencyToken: string;
  checked: boolean;
}

/**
 * Layer 2: PlansComponent
 * Native Playwright self-healing POM for Preview pricing plans, Save % badges, and radio selection.
 * Zero static timeouts & zero hardcoded currency signs.
 */
export class PlansComponent {
  private logger = new Logger('PlansComponent');

  constructor(private page: Page) {}

  packageSection = (): Locator =>
    this.page
      .locator('section:has(input[type="email"])')
      .or(this.page.locator('[aria-label="Choose Package"]'))
      .first();

  radioGroup = (): Locator =>
    this.packageSection()
      .getByRole('radiogroup')
      .or(this.page.getByRole('radiogroup'))
      .first();

  planOptions = (): Locator =>
    this.radioGroup()
      .getByRole('radio')
      .or(this.radioGroup().locator('[role="radio"]'));

  plansContainer = (): Locator =>
    this.page.locator('[aria-label="Choose Package"], div:has(h2:has-text("Choose Package")), div:has-text("10 reports")').first();

  saveBadges = (): Locator =>
    this.page.locator('text=/Save \d+%/i');

  planCard = (reports: number): Locator =>
    this.page.locator(`div:has-text("${reports} Report"), div:has-text("${reports} Reports")`).first();

  tenReportsPlan = (): Locator =>
    this.page.locator('text=/10 Reports/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  twoReportsPlan = (): Locator =>
    this.page.locator('text=/2 Reports/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  oneReportPlan = (): Locator =>
    this.page.locator('text=/1 Report/i >> xpath=ancestor::div[contains(@class, "border") or contains(@class, "card") or contains(@class, "cursor-pointer")][1]').first();

  /**
   * Reads every radio plan card dynamically with currency-agnostic active total parsing.
   */
  async readAllPlans(): Promise<PlanOptionInfo[]> {
    await expect(this.planOptions().first()).toBeVisible();
    const count = await this.planOptions().count();
    const plans: PlanOptionInfo[] = [];

    for (let i = 0; i < count; i++) {
      const option = this.planOptions().nth(i);
      const checked = (await option.getAttribute('aria-checked')) === 'true';

      const domData = await option.evaluate((el) => {
        const spans = Array.from(el.querySelectorAll('span'));
        const leafLabelSpan =
          spans.find(
            (s) =>
              s.children.length === 0 &&
              /^\d+\s*(report|sticker|sheet)/i.test((s.textContent || '').trim())
          ) || spans.find((s) => /\d+\s*(report|sticker|sheet)/i.test(s.textContent || ''));
        const label =
          (leafLabelSpan?.textContent || '').replace(/\s+/g, ' ').trim() ||
          (el.textContent || '').split(/\n/)[0].trim();

        const totalEl = spans.find((s) => /Total:/i.test(s.textContent || '')) || spans[spans.length - 1];
        let totalRaw = '';
        if (totalEl) {
          const clone = totalEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('s, del').forEach((n) => n.remove());
          totalRaw = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        }
        return { label, totalRaw };
      });

      const countMatch = domData.label.match(/(\d+)/);
      const parsedTotal = PriceParser.parseLastPrice(domData.totalRaw);

      plans.push({
        index: i,
        label: domData.label,
        count: countMatch ? Number(countMatch[1]) : 1,
        totalRaw: domData.totalRaw,
        totalAmount: parsedTotal.amount,
        currencyToken: parsedTotal.currencyToken,
        checked,
      });
    }

    this.logger.info(
      `Read ${plans.length} plan(s): ${plans.map((p) => `${p.label}=${p.totalAmount}${p.checked ? ' [selected]' : ''}`).join(', ')}`
    );
    return plans;
  }

  /**
   * Selects a radio plan by index with Exit-Intent overlay protection and asserts aria-checked="true".
   */
  async selectPlanByIndex(index: number): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      const option = this.planOptions().nth(index);
      await expect(option).toBeVisible();
      await option.click();
      await expect(option).toHaveAttribute('aria-checked', 'true');
    });
  }

  async getSaveTags(): Promise<string[]> {
    const badges = this.saveBadges();
    const count = await badges.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }
}
