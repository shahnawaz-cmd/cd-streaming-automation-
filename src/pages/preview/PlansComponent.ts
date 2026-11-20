import { expect, Page, Locator } from '@playwright/test';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';
import { PriceParser } from '../../utils/PriceParser';
import { Logger } from '../../utils/Logger';

export interface PlanOptionInfo {
  index: number;
  label: string;
  count: number;
  unitRaw: string;
  unitAmount: number;
  unitLabel: string;
  totalRaw: string;
  totalAmount: number;
  strikeRaw: string | null;
  strikeAmount: number | null;
  saveBadgeText: string | null;
  savePercent: number | null;
  currencyToken: string;
  isSubscription: boolean;
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
      .or(this.page.locator('section[aria-labelledby="pv-package-heading"]'))
      .or(this.page.locator('[aria-label="Choose Package"]'))
      .first();

  packageSubtitle = (): Locator =>
    this.packageSection()
      .locator('h2 + p')
      .or(this.packageSection().locator('p').filter({ hasText: /%/ }))
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
   * Reads the package section subtitle (e.g., "Bigger packages save up to 66%.") and extracts its max percentage.
   */
  async readSubtitleMaxSavePercent(): Promise<{ text: string; maxSavePercent: number | null }> {
    const subtitle = this.packageSubtitle();
    if (!(await subtitle.isVisible().catch(() => false))) {
      return { text: '', maxSavePercent: null };
    }
    const text = (await subtitle.innerText()).replace(/\s+/g, ' ').trim();
    const match = text.match(/(\d+)\s*%/);
    return { text, maxSavePercent: match ? Number(match[1]) : null };
  }

  /**
   * Reads every radio plan card dynamically with currency-agnostic active total, strikethrough, per-unit, and Save % parsing.
   */
  async readAllPlans(): Promise<PlanOptionInfo[]> {
    await expect(this.planOptions().first()).toBeVisible();
    const count = await this.planOptions().count();
    const plans: PlanOptionInfo[] = [];

    for (let i = 0; i < count; i++) {
      const option = this.planOptions().nth(i);
      const checked = (await option.getAttribute('aria-checked')) === 'true';

      const domData = await option.evaluate((el) => {
        const cleanText = (node: Element | null | undefined) =>
          (node?.textContent || '').replace(/\s+/g, ' ').trim();

        const allSpans = Array.from(el.querySelectorAll('span'));
        const leafSpans = allSpans.filter((s) => s.children.length === 0);

        const saveBadgeEl =
          leafSpans.find(
            (s) => /\bSave\b/i.test(cleanText(s)) && /\d+\s*%/.test(cleanText(s))
          ) ||
          leafSpans.find(
            (s) => /success/i.test(s.className || '') && /\d+\s*%/.test(cleanText(s))
          ) ||
          leafSpans.find((s) => /\d+\s*%/.test(cleanText(s))) ||
          null;
        const saveBadgeText = saveBadgeEl ? cleanText(saveBadgeEl) : null;

        const headerRow = el.firstElementChild;
        const headerLeafSpans = headerRow
          ? Array.from(headerRow.querySelectorAll('span')).filter((s) => s.children.length === 0)
          : [];

        const labelEl =
          leafSpans.find(
            (s) =>
              s !== saveBadgeEl &&
              /^\d+\s+(?:[A-Za-z]+\s+)*(?:report|sticker|sheet|credit)s?$/i.test(cleanText(s))
          ) ||
          headerLeafSpans.find((s) => s !== saveBadgeEl) ||
          leafSpans.find((s) => s !== saveBadgeEl) ||
          null;
        const label = cleanText(labelEl) || (el.textContent || '').split(/\n/)[0].trim();

        const totalEl =
          allSpans.find((s) => /Total\s*:/i.test(cleanText(s))) ||
          allSpans.find((s) => !!s.querySelector('s, del')) ||
          allSpans.find(
            (s) =>
              s !== labelEl &&
              s !== saveBadgeEl &&
              /^[^:\d]{2,20}:\s*\D*\d/.test(cleanText(s))
          ) ||
          null;

        const strikeEl = (totalEl?.querySelector('s, del') || el.querySelector('s, del')) as
          | HTMLElement
          | null;
        const strikeRaw = strikeEl ? cleanText(strikeEl) : null;

        let totalRaw = '';
        if (totalEl) {
          const clone = totalEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('s, del').forEach((n) => n.remove());
          totalRaw = cleanText(clone);
        }

        const remainingLeaves = leafSpans.filter(
          (s) =>
            s !== labelEl &&
            s !== saveBadgeEl &&
            s !== totalEl &&
            !(totalEl && totalEl.contains(s)) &&
            !(strikeEl && strikeEl.contains(s))
        );

        const unitPriceEl =
          remainingLeaves.find(
            (s) => /font-bold|text-xl/i.test(s.className || '') && /\d/.test(cleanText(s))
          ) ||
          remainingLeaves.find((s) => /\d/.test(cleanText(s)) && !/%/.test(cleanText(s))) ||
          null;
        const unitRaw = cleanText(unitPriceEl) || totalRaw;

        const unitLabelEl =
          remainingLeaves.find(
            (s) => s !== unitPriceEl && !/\d/.test(cleanText(s)) && cleanText(s).length > 0
          ) || null;
        const unitLabel = cleanText(unitLabelEl);

        return {
          label,
          saveBadgeText,
          unitRaw,
          unitLabel,
          totalRaw,
          strikeRaw,
          cardText: cleanText(el),
        };
      });

      const parsedUnit = PriceParser.parseLastPrice(domData.unitRaw || domData.totalRaw);
      const parsedTotal = domData.totalRaw
        ? PriceParser.parseLastPrice(domData.totalRaw)
        : parsedUnit;
      const parsedStrike = domData.strikeRaw
        ? PriceParser.parseLastPrice(domData.strikeRaw)
        : null;
      const saveMatch = domData.saveBadgeText?.match(/(\d+)\s*%/);
      const savePercent = saveMatch ? Number(saveMatch[1]) : null;
      const isSubscription =
        /\b(per\s+month|\/\s*mo|monthly|subscription)\b/i.test(
          `${domData.unitLabel} ${domData.label}`
        ) ||
        (!domData.totalRaw && /\bmonth\b/i.test(domData.cardText));
      const countMatch = domData.label.match(/\b(\d+)\b/);
      const planCount = isSubscription ? 0 : countMatch ? Number(countMatch[1]) : 1;
      const currencyToken =
        parsedTotal.currencyToken || parsedUnit.currencyToken || parsedStrike?.currencyToken || '';

      plans.push({
        index: i,
        label: domData.label,
        count: planCount,
        unitRaw: domData.unitRaw,
        unitAmount: parsedUnit.amount,
        unitLabel: domData.unitLabel,
        totalRaw: domData.totalRaw || domData.unitRaw,
        totalAmount: parsedTotal.amount,
        strikeRaw: domData.strikeRaw,
        strikeAmount: parsedStrike ? parsedStrike.amount : null,
        saveBadgeText: domData.saveBadgeText,
        savePercent,
        currencyToken,
        isSubscription,
        checked,
      });
    }

    this.logger.info(
      `Read ${plans.length} plan(s): ${plans
        .map(
          (p) =>
            `${p.label}=${p.totalAmount}${p.strikeAmount ? ` (was ${p.strikeAmount})` : ''}${
              p.savePercent !== null ? ` [Save ${p.savePercent}%]` : ''
            }${p.checked ? ' [selected]' : ''}`
        )
        .join(', ')}`
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
