import { expect, Page } from '@playwright/test';
import { PreviewPage, PreviewType } from '../pages/preview/PreviewPage';
import { UpsellSnapshot } from '../pages/preview/UpsellComponent';
import { ClassicDecodeHandler } from './ClassicDecodeHandler';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { SiteSettingsUpsellConfig } from './SiteSettingsModule';
import { VinGenerator } from '../data/VinGenerator';
import { PriceParser } from '../utils/PriceParser';
import { Logger } from '../utils/Logger';

export type VehicleKind = 'CLASSIC' | 'MODERN';

export interface UpsellVariantResult {
  kind: VehicleKind;
  previewType: PreviewType;
  vin: string;
  url: string;
  upsell: UpsellSnapshot;
  expectedSiteSettingText: string | null;
  textAlignedWithSiteSettings: boolean;
  ctaBeforeToggle: number;
  ctaAfterToggleOn: number;
  ctaAfterToggleOff: number;
  currencyToken: string;
}

export interface UpsellMatrixResult {
  siteSettings: SiteSettingsUpsellConfig;
  classicVhr: UpsellVariantResult;
  classicSticker: UpsellVariantResult;
  modernVhr: UpsellVariantResult;
  modernSticker: UpsellVariantResult;
  gifAssertions: {
    classicVsModernVhrDifferent: boolean;
    classicVsModernStickerDifferent: boolean;
    classicVhrVsStickerDifferent: boolean;
    modernVhrVsStickerDifferent: boolean;
  };
}

function normalizeWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Layer 3: UpsellModule
 * Dedicated to verifying Classic vs Modern upsell GIF uniqueness, site_settings text alignment,
 * and currency-agnostic upsell checkbox CTA price synchronization across type=vhr & type=sticker.
 */
export class UpsellModule {
  private logger = new Logger('UpsellModule');

  constructor(
    private page: Page,
    private previewPage: PreviewPage,
    private classicDecodeHandler: ClassicDecodeHandler,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  private async resolveDecodedVin(kind: VehicleKind): Promise<string> {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const vin = kind === 'CLASSIC' ? VinGenerator.classicMapped() : await VinGenerator.modernFromMongo();
      await this.previewPage.openDirectly(vin, 'vhr');

      if (kind === 'CLASSIC') {
        const outcome = await this.classicDecodeHandler.verifyOutcome();
        if (outcome === 'DECODED') {
          this.logger.pass(`Decoded ${kind} VIN ${vin} cleanly (attempt ${attempt})`);
          return vin;
        }
      } else {
        const outcome = await this.previewCheckoutModule.waitForLocalizedDecodeOutcome();
        if (outcome === 'DECODED') {
          this.logger.pass(`Decoded ${kind} VIN ${vin} cleanly (attempt ${attempt})`);
          return vin;
        }
      }
      this.logger.warn(`Attempt ${attempt}/${maxAttempts}: ${kind} VIN ${vin} fell back; trying another VIN...`);
    }
    throw new Error(`[UpsellModule] Failed to decode a ${kind} VIN in ${maxAttempts} attempts`);
  }

  private async waitForDecodeOnCurrentType(kind: VehicleKind): Promise<void> {
    if (kind === 'CLASSIC') {
      const outcome = await this.classicDecodeHandler.verifyOutcome();
      expect(outcome, 'Expected Classic Preview page to stay decoded').toBe('DECODED');
    } else {
      const outcome = await this.previewCheckoutModule.waitForLocalizedDecodeOutcome();
      expect(outcome, 'Expected Modern Preview page to stay decoded').toBe('DECODED');
    }
  }

  private async inspectPreviewUpsell(
    kind: VehicleKind,
    previewType: PreviewType,
    vin: string,
    siteSettings: SiteSettingsUpsellConfig,
    alreadyLoaded: boolean
  ): Promise<UpsellVariantResult> {
    if (!alreadyLoaded) {
      await this.previewPage.openDirectly(vin, previewType);
      await this.waitForDecodeOnCurrentType(kind);
    }

    const upsell = await this.previewPage.upsell.readSnapshot();
    expect(upsell.gifSrc, `${kind} ${previewType} upsell GIF src should exist`).toBeTruthy();
    expect(upsell.naturalWidth, `${kind} ${previewType} upsell GIF should load cleanly`).toBeGreaterThan(0);

    let expectedSiteSettingText: string | null = null;
    let textAlignedWithSiteSettings = false;

    if (kind === 'CLASSIC') {
      expectedSiteSettingText =
        previewType === 'vhr' ? siteSettings.stickerCheckboxText : siteSettings.reportCheckboxText;
      expect(
        normalizeWs(upsell.description),
        `Classic ${previewType} upsell text should match site_settings`
      ).toBe(normalizeWs(expectedSiteSettingText));
      textAlignedWithSiteSettings = true;
    } else if (previewType === 'vhr') {
      expect(upsell.description, 'Modern vhr upsell text should describe build sheet add-on').toMatch(
        /build\s*sheet/i
      );
      expect(normalizeWs(upsell.description)).not.toBe(normalizeWs(siteSettings.stickerCheckboxText));
    } else {
      expect(upsell.description, 'Modern sticker upsell text should describe history report add-on').toMatch(
        /history\s*report|report/i
      );
      expect(normalizeWs(upsell.description)).not.toBe(normalizeWs(siteSettings.reportCheckboxText));
    }

    const cta = this.previewPage.header.packageAccessCta();
    await expect(cta).toBeEnabled();
    const baseCta = PriceParser.parseLastPrice(await cta.innerText());

    await this.previewPage.upsell.toggleOn();
    let ctaOnAmount = baseCta.amount;
    await expect(async () => {
      const parsed = PriceParser.parseLastPrice(await cta.innerText());
      ctaOnAmount = parsed.amount;
      PriceParser.assertAmountClose(
        ctaOnAmount,
        baseCta.amount + upsell.activePriceAmount,
        `${kind} ${previewType} CTA after upsell ON`
      );
    }).toPass();

    await this.previewPage.upsell.toggleOff();
    let ctaOffAmount = ctaOnAmount;
    await expect(async () => {
      const parsed = PriceParser.parseLastPrice(await cta.innerText());
      ctaOffAmount = parsed.amount;
      PriceParser.assertAmountClose(
        ctaOffAmount,
        baseCta.amount,
        `${kind} ${previewType} CTA after upsell OFF`
      );
    }).toPass();

    this.logger.pass(
      `${kind} [${previewType}] verified: gif=${upsell.gifSrc} | CTA ${baseCta.amount} -> ${ctaOnAmount} -> ${ctaOffAmount} (${baseCta.currencyToken || upsell.currencyToken})`
    );

    return {
      kind,
      previewType,
      vin,
      url: this.page.url(),
      upsell,
      expectedSiteSettingText,
      textAlignedWithSiteSettings,
      ctaBeforeToggle: baseCta.amount,
      ctaAfterToggleOn: ctaOnAmount,
      ctaAfterToggleOff: ctaOffAmount,
      currencyToken: baseCta.currencyToken || upsell.currencyToken,
    };
  }

  /**
   * Verifies Classic vs Modern upsell GIF differences, site_settings text alignment,
   * and Preview CTA toggle sync across both type=vhr and type=sticker.
   */
  async verifyModernVsClassicMatrix(siteSettings: SiteSettingsUpsellConfig): Promise<UpsellMatrixResult> {
    const classicVin = await this.resolveDecodedVin('CLASSIC');
    const classicVhr = await this.inspectPreviewUpsell('CLASSIC', 'vhr', classicVin, siteSettings, true);
    const classicSticker = await this.inspectPreviewUpsell('CLASSIC', 'sticker', classicVin, siteSettings, false);

    const modernVin = await this.resolveDecodedVin('MODERN');
    const modernVhr = await this.inspectPreviewUpsell('MODERN', 'vhr', modernVin, siteSettings, true);
    const modernSticker = await this.inspectPreviewUpsell('MODERN', 'sticker', modernVin, siteSettings, false);

    expect(
      classicVhr.upsell.gifSrc,
      'Classic and Modern type=vhr upsell GIFs must differ'
    ).not.toBe(modernVhr.upsell.gifSrc);

    expect(
      classicSticker.upsell.gifSrc,
      'Classic and Modern type=sticker upsell GIFs must differ'
    ).not.toBe(modernSticker.upsell.gifSrc);

    expect(
      classicVhr.upsell.gifSrc,
      'Classic type=vhr and type=sticker upsell GIFs must differ'
    ).not.toBe(classicSticker.upsell.gifSrc);

    expect(
      modernVhr.upsell.gifSrc,
      'Modern type=vhr and type=sticker upsell GIFs must differ'
    ).not.toBe(modernSticker.upsell.gifSrc);

    this.logger.pass(
      `All 4 upsell GIFs distinct: Classic(${classicVhr.upsell.gifSrc}, ${classicSticker.upsell.gifSrc}) vs Modern(${modernVhr.upsell.gifSrc}, ${modernSticker.upsell.gifSrc})`
    );

    return {
      siteSettings,
      classicVhr,
      classicSticker,
      modernVhr,
      modernSticker,
      gifAssertions: {
        classicVsModernVhrDifferent: classicVhr.upsell.gifSrc !== modernVhr.upsell.gifSrc,
        classicVsModernStickerDifferent: classicSticker.upsell.gifSrc !== modernSticker.upsell.gifSrc,
        classicVhrVsStickerDifferent: classicVhr.upsell.gifSrc !== classicSticker.upsell.gifSrc,
        modernVhrVsStickerDifferent: modernVhr.upsell.gifSrc !== modernSticker.upsell.gifSrc,
      },
    };
  }
}
