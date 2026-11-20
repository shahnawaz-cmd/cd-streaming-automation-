import { BrowserContext, expect, Page } from '@playwright/test';
import { PricingPage } from '../pages/pricing';
import { Logger } from '../utils/Logger';

export interface FaqItemResult {
  question: string;
  answerPreview: string;
}

export interface PricingFaqResult {
  questionCount: number;
  items: FaqItemResult[];
  sampleReportHref: string;
  sampleReportUrl: string;
}

/**
 * Layer 3: PricingFaqModule
 * Every FAQ question expands to a non-empty answer and collapses again; the "View Sample Report" link navigates.
 */
export class PricingFaqModule {
  private logger = new Logger('PricingFaqModule');

  constructor(
    private page: Page,
    private context: BrowserContext,
    private pricingPage: PricingPage
  ) {}

  async verifyFaqAndSampleLink(): Promise<PricingFaqResult> {
    await this.pricingPage.open();
    // Client-rendered plan cards => the page is hydrated, so accordion clicks are actually handled
    await expect(this.pricingPage.plans.cards().first()).toBeVisible();

    const items = await this.verifyAccordion();
    const sample = await this.verifySampleReportLink();
    return { questionCount: items.length, items, ...sample };
  }

  private async verifyAccordion(): Promise<FaqItemResult[]> {
    const questions = this.pricingPage.faq.questions();
    const count = await questions.count();
    expect(count, 'FAQ questions are rendered').toBeGreaterThan(0);

    const items: FaqItemResult[] = [];
    for (let i = 0; i < count; i++) {
      const question = questions.nth(i);
      const label = (await question.innerText()).trim();
      const answer = await this.pricingPage.faq.answerOf(question);

      await question.click();
      await expect(question, `"${label}" expands`).toHaveAttribute('aria-expanded', 'true');
      await expect(answer, `"${label}" shows its answer`).toBeVisible();
      await expect(answer, `"${label}" answer is not empty`).not.toHaveText(/^\s*$/);
      items.push({ question: label, answerPreview: ((await answer.innerText()).replace(/\s+/g, ' ')).slice(0, 80) });

      await question.click();
      await expect(question, `"${label}" collapses`).toHaveAttribute('aria-expanded', 'false');
      await expect(answer, `"${label}" hides its answer`).toBeHidden();
    }
    this.logger.pass(`${count} FAQ items expand and collapse`);
    return items;
  }

  /** The link opens the sample reports in a new tab (`target=_blank`), leaving Pricing untouched. */
  private async verifySampleReportLink(): Promise<{ sampleReportHref: string; sampleReportUrl: string }> {
    const link = this.pricingPage.faq.sampleReportLink();
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href')) ?? '';
    expect(href, 'sample report link target').toMatch(/sample/i);

    const [sample] = await Promise.all([this.context.waitForEvent('page'), link.click()]);
    await sample.waitForURL(/sample/i);
    await expect(sample.getByRole('heading', { level: 1 }), 'sample reports page renders').toBeVisible();
    expect(this.page.url(), 'Pricing stays open in the original tab').toContain('/pricing');
    const sampleReportUrl = sample.url();
    await sample.close();
    this.logger.pass(`Sample report link -> ${sampleReportUrl} (new tab)`);
    return { sampleReportHref: href, sampleReportUrl };
  }
}
