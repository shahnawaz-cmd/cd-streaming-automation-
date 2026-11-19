import { Page, Locator, expect } from '@playwright/test';
import { SelfHealingAgent } from '../../utils/SelfHealingAgent';

/**
 * PreviewHeaderComponent
 * Encapsulates Hero title, Access Record CTA, and Decoding status.
 */
export class PreviewHeaderComponent {
  private healer: SelfHealingAgent;

  constructor(private page: Page) {
    this.healer = new SelfHealingAgent(page);
  }

  // Locators as arrow functions
  heroCard = (): Locator =>
    this.page.locator('[data-testid="preview-header"], section:has(h1), div:has(h1):has(button)').first();

  vehicleTitle = (): Locator =>
    this.page.locator('h1, h2, [data-testid="vehicle-title"]').first();

  accessRecordCta = (): Locator =>
    this.page.locator('button:has-text("Access Vehicle History"), button:has-text("Access Build Sheet"), [data-testid="preview-cta"]').first();

  loadingSpinner = (): Locator =>
    this.page.locator('[data-testid="decoding-spinner"], [aria-busy="true"], .animate-spin').first();

  vinBadge = (): Locator =>
    this.page.locator('[data-testid="vin-badge"], .vin-badge').first();

  // Language-agnostic structural locators for localized Package & Delivery section
  packageSection = (): Locator =>
    this.page.locator('section:has(input[type="email"])').first();

  packageAccessCta = (): Locator =>
    this.packageSection().locator('button[aria-busy]').first();

  deliveryAccordionBtn = (): Locator =>
    this.packageSection().locator('button[aria-controls="pv-delivery"]').first();

  deliveryEmailInput = (): Locator =>
    this.packageSection().locator('input[type="email"]').first();

  /**
   * Resolves the Access Record CTA with autonomous self-healing.
   */
  async getHealedCta(timeoutMs = 30_000): Promise<Locator> {
    return this.healer.find(
      'Access Record CTA Button',
      [
        { role: 'button', name: /Access Vehicle History|Access Build Sheet/i },
        '[data-testid="preview-cta"]',
        'button:has-text("Access Vehicle History")',
        'button:has-text("Access Build Sheet")',
        'a:has-text("Access Vehicle History")',
        'button.cta-primary',
      ],
      timeoutMs
    );
  }

  /**
   * Checks if decoding is currently in progress:
   * Verified by the spinner being visible OR the CTA button having disabled state.
   */
  async isDecodingActive(): Promise<boolean> {
    const isSpinnerVisible = await this.loadingSpinner().isVisible().catch(() => false);
    const isCtaDisabled = await this.accessRecordCta().isDisabled().catch(() => false);
    return isSpinnerVisible || isCtaDisabled;
  }

  /**
   * Smart Decoding Guard:
   * Waits for decoding completion and verifies CTA transitions to enabled.
   */
  async waitForDecodingComplete(timeoutMs = 60_000): Promise<void> {
    const cta = await this.getHealedCta();
    await expect(cta).toBeEnabled({ timeout: timeoutMs });
  }
}
