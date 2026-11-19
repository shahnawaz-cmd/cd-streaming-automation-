import { Locator, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

export type LocatorStrategy =
  | string
  | { role: Parameters<Page['getByRole']>[0]; name?: string | RegExp }
  | { text: string | RegExp }
  | { testId: string }
  | { placeholder: string | RegExp }
  | { label: string | RegExp }
  | (() => Locator);

export interface HealedEvent {
  timestamp: string;
  elementName: string;
  originalStrategy: string;
  healedStrategy: string;
  healedIndex: number;
}

export class SelfHealingAgent {
  private logger = new Logger('SelfHealingAgent');
  private static healedLog: HealedEvent[] = [];

  constructor(private page: Page) {}

  /**
   * Resolves a locator candidate into a Playwright Locator object.
   */
  private resolveCandidate(candidate: LocatorStrategy): { locator: Locator; description: string } {
    if (typeof candidate === 'string') {
      return { locator: this.page.locator(candidate).first(), description: candidate };
    }
    if (typeof candidate === 'function') {
      return { locator: candidate(), description: '[Custom Locator Function]' };
    }
    if ('testId' in candidate) {
      return { locator: this.page.getByTestId(candidate.testId).first(), description: `getByTestId("${candidate.testId}")` };
    }
    if ('role' in candidate) {
      const nameStr = candidate.name ? `, name: "${candidate.name}"` : '';
      return {
        locator: this.page.getByRole(candidate.role, candidate.name ? { name: candidate.name } : undefined).first(),
        description: `getByRole("${candidate.role}"${nameStr})`,
      };
    }
    if ('text' in candidate) {
      return { locator: this.page.getByText(candidate.text).first(), description: `getByText("${candidate.text}")` };
    }
    if ('placeholder' in candidate) {
      return { locator: this.page.getByPlaceholder(candidate.placeholder).first(), description: `getByPlaceholder("${candidate.placeholder}")` };
    }
    if ('label' in candidate) {
      return { locator: this.page.getByLabel(candidate.label).first(), description: `getByLabel("${candidate.label}")` };
    }
    return { locator: this.page.locator(String(candidate)).first(), description: String(candidate) };
  }

  /**
   * Finds the first visible and interactive locator from an array of fallback strategies.
   * If a fallback succeeds after the primary fails, records a self-healing event.
   */
  async find(
    elementName: string,
    strategies: LocatorStrategy[],
    timeoutMs = 15_000
  ): Promise<Locator> {
    const deadline = Date.now() + timeoutMs;
    const candidates = strategies.map((s) => this.resolveCandidate(s));

    while (Date.now() < deadline) {
      for (let i = 0; i < candidates.length; i++) {
        const { locator, description } = candidates[i];
        try {
          if (await locator.isVisible()) {
            if (i > 0) {
              const primary = candidates[0].description;
              this.recordHealing(elementName, primary, description, i);
            }
            return locator;
          }
        } catch (_) {
          // continue checking other candidates
        }
      }
      await this.page.waitForTimeout(200);
    }

    const allTried = candidates.map((c) => c.description).join(' | ');
    throw new Error(
      `[SelfHealingAgent] Failed to locate '${elementName}' within ${timeoutMs}ms. Tried strategies: ${allTried}`
    );
  }

  /**
   * Clicks an element with self-healing fallback.
   */
  async click(elementName: string, strategies: LocatorStrategy[], timeoutMs = 15_000): Promise<void> {
    const locator = await this.find(elementName, strategies, timeoutMs);
    await locator.click();
  }

  /**
   * Fills an input element with self-healing fallback.
   */
  async fill(
    elementName: string,
    strategies: LocatorStrategy[],
    value: string,
    timeoutMs = 15_000
  ): Promise<void> {
    const locator = await this.find(elementName, strategies, timeoutMs);
    await locator.click();
    await locator.fill(value);
  }

  /**
   * Logs and persists self-healing telemetry.
   */
  private recordHealing(
    elementName: string,
    originalStrategy: string,
    healedStrategy: string,
    healedIndex: number
  ): void {
    const event: HealedEvent = {
      timestamp: new Date().toISOString(),
      elementName,
      originalStrategy,
      healedStrategy,
      healedIndex,
    };

    SelfHealingAgent.healedLog.push(event);
    this.logger.warn(
      `🛠️ [SELF-HEALED] '${elementName}': Primary '${originalStrategy}' failed -> Recovered via strategy #${healedIndex} '${healedStrategy}'`
    );

    // Attach to current Playwright test report if active
    try {
      test.info().annotations.push({
        type: 'Self-Healed Locator',
        description: `'${elementName}' recovered using '${healedStrategy}'`,
      });
    } catch (_) {}

    // Persist to report file
    try {
      const outputDir = path.resolve(process.cwd(), 'test-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(outputDir, 'healed-locators.json'),
        JSON.stringify(SelfHealingAgent.healedLog, null, 2)
      );
    } catch (_) {}
  }
}
