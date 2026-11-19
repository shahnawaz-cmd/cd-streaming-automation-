import { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { PreviewHeaderComponent } from './PreviewHeaderComponent';
import { EditYmmModalComponent } from './EditYmmModalComponent';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';
import { AuctionHistoryComponent } from './AuctionHistoryComponent';
import { BuildSheetComponent } from './BuildSheetComponent';
import { NotFoundFallbackComponent } from './NotFoundFallbackComponent';
import { ClassicFallbackComponent } from './ClassicFallbackComponent';
import { PlansComponent } from './PlansComponent';

export type PreviewType = 'vhr' | 'sticker';

/**
 * PreviewPage (Unified Modular Page Object)
 * Composes focused sub-components including NotFoundFallbackComponent, ClassicFallbackComponent, and PlansComponent.
 */
export class PreviewPage extends BasePage {
  // Modular Sub-Components
  readonly header: PreviewHeaderComponent;
  readonly editYmm: EditYmmModalComponent;
  readonly exitIntent: ExitIntentModalComponent;
  readonly auctionHistory: AuctionHistoryComponent;
  readonly buildSheet: BuildSheetComponent;
  readonly notFound: NotFoundFallbackComponent;
  readonly classicFallback: ClassicFallbackComponent;
  readonly plans: PlansComponent;

  constructor(page: Page) {
    super(page);
    this.header = new PreviewHeaderComponent(page);
    this.editYmm = new EditYmmModalComponent(page);
    this.exitIntent = new ExitIntentModalComponent(page);
    this.auctionHistory = new AuctionHistoryComponent(page);
    this.buildSheet = new BuildSheetComponent(page);
    this.notFound = new NotFoundFallbackComponent(page);
    this.classicFallback = new ClassicFallbackComponent(page);
    this.plans = new PlansComponent(page);
  }

  // Navigation
  async openDirectly(vin: string, type: PreviewType = 'vhr'): Promise<void> {
    await this.navigate(`/preview?vin=${vin}&wpPage=homepage&type=${type}`);
  }

  // Delegated conveniences
  accessRecordCta = (): Locator => this.header.accessRecordCta();
  decodingIndicator = (): Locator => this.header.loadingSpinner();
  vehicleTitle = (): Locator => this.header.vehicleTitle();

  async getHealedCta(timeoutMs = 30_000): Promise<Locator> {
    return this.header.getHealedCta(timeoutMs);
  }

  async isDecodingActive(): Promise<boolean> {
    return this.header.isDecodingActive();
  }

  async clickAccessRecord(): Promise<void> {
    const cta = await this.getHealedCta();
    await cta.click();
  }

  async getVehicleTitle(): Promise<string> {
    return (await this.header.vehicleTitle().textContent().catch(() => ''))?.trim() || '';
  }

  /**
   * Scrapes structured specifications key-value map from the decoded preview page.
   */
  async getSpecifications(): Promise<Record<string, string>> {
    const specsMap: Record<string, string> = {};
    const specsSection = this.page.locator('section:has-text("Specifications"), div:has(h2:has-text("Specifications"))').first();
    if (await specsSection.isVisible().catch(() => false)) {
      const items = await specsSection.locator('div > div:has(> span), div > div:has(> div), dl > div').all();
      for (const item of items) {
        const text = (await item.innerText().catch(() => '')).trim();
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          specsMap[lines[0]] = lines[1];
        }
      }
    }
    return specsMap;
  }
}
