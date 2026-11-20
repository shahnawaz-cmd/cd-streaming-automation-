import { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { PreviewHeaderComponent } from './PreviewHeaderComponent';
import { EditYmmModalComponent } from './EditYmmModalComponent';
import { EditSpecsModalComponent } from './EditSpecsModalComponent';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';
import { AuctionHistoryComponent } from './AuctionHistoryComponent';
import { BuildSheetComponent } from './BuildSheetComponent';
import { NotFoundFallbackComponent } from './NotFoundFallbackComponent';
import { ClassicFallbackComponent } from './ClassicFallbackComponent';
import { ShortVinErrorComponent } from './ShortVinErrorComponent';
import { AddToGarageModalComponent } from './AddToGarageModalComponent';
import { PlansComponent } from './PlansComponent';
import { UpsellComponent } from './UpsellComponent';

export type PreviewType = 'vhr' | 'sticker';

/**
 * PreviewPage (Unified Modular Page Object)
 * Composes focused sub-components including NotFoundFallbackComponent, ClassicFallbackComponent, and PlansComponent.
 */
export class PreviewPage extends BasePage {
  // Modular Sub-Components
  readonly header: PreviewHeaderComponent;
  readonly editYmm: EditYmmModalComponent;
  readonly editSpecs: EditSpecsModalComponent;
  readonly exitIntent: ExitIntentModalComponent;
  readonly auctionHistory: AuctionHistoryComponent;
  readonly buildSheet: BuildSheetComponent;
  readonly notFound: NotFoundFallbackComponent;
  readonly classicFallback: ClassicFallbackComponent;
  readonly shortVinError: ShortVinErrorComponent;
  readonly addToGarage: AddToGarageModalComponent;
  readonly plans: PlansComponent;
  readonly upsell: UpsellComponent;

  constructor(page: Page) {
    super(page);
    this.header = new PreviewHeaderComponent(page);
    this.editYmm = new EditYmmModalComponent(page);
    this.editSpecs = new EditSpecsModalComponent(page);
    this.exitIntent = new ExitIntentModalComponent(page);
    this.auctionHistory = new AuctionHistoryComponent(page);
    this.buildSheet = new BuildSheetComponent(page);
    this.notFound = new NotFoundFallbackComponent(page);
    this.classicFallback = new ClassicFallbackComponent(page);
    this.shortVinError = new ShortVinErrorComponent(page);
    this.addToGarage = new AddToGarageModalComponent(page);
    this.plans = new PlansComponent(page);
    this.upsell = new UpsellComponent(page);
  }

  // Navigation
  async openDirectly(vin: string, type: PreviewType = 'vhr', offer?: string): Promise<void> {
    const params = new URLSearchParams({ vin, wpPage: 'homepage', type });
    if (offer) params.set('offer', offer);
    await this.navigate(`/preview?${params.toString()}`);
  }

  /** Opens Preview with extra tracking query params (e.g. UTMs) and an optional HTTP referrer. */
  async openWithTracking(
    vin: string,
    tracking: Record<string, string> = {},
    referer?: string,
    type: PreviewType = 'vhr'
  ): Promise<void> {
    const params = new URLSearchParams({ vin, wpPage: 'homepage', type, ...tracking });
    await this.page.goto(`/preview?${params}`, { waitUntil: 'domcontentloaded', referer });
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
