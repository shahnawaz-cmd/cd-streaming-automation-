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
}
