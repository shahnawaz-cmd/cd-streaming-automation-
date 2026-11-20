import { Browser, expect, Page } from '@playwright/test';
import { PreviewPage, PreviewType } from '../pages/preview/PreviewPage';
import { PlanOptionInfo } from '../pages/preview/PlansComponent';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { PriceParser } from '../utils/PriceParser';
import { BrowserSession } from '../utils/BrowserSession';
import { Logger } from '../utils/Logger';

export interface PlanSaveCheckItem {
  label: string;
  count: number;
  isSubscription: boolean;
  baselineTotal: number;
  baselineStrike: number | null;
  baselineSavePercent: number | null;
  couponTotal: number;
  couponStrike: number | null;
  couponSavePercent: number | null;
  expectedBaselineSavePercent: number | null;
  expectedCouponSavePercent: number | null;
  expectedCompoundedSavePercent: number | null;
  expectedCouponTotal: number;
  ctaSyncedAmount: number;
  currencyToken: string;
}

export interface PlansCouponComparisonResult {
  previewType: PreviewType;
  vin: string;
  offerCode: string;
  baselineCurrency: string;
  couponCurrency: string;
  conversionFactor: number;
  effectiveCouponRate: number;
  baselineSubtitleMaxSave: number | null;
  couponSubtitleMaxSave: number | null;
  baselinePlanCount: number;
  couponPlanCount: number;
  planChecks: PlanSaveCheckItem[];
}

export interface PlansSaveTagMatrixResult {
  vin: string;
  offerCode: string;
  vhr: PlansCouponComparisonResult;
  sticker: PlansCouponComparisonResult;
}

/**
 * Layer 3: PlansSaveTagModule
 * Validates dynamic Plans "Save %" badge calculation, strikethrough retail anchor,
 * compounded coupon discount math, subscription exclusion, currency conversion scaling,
 * and interactive CTA price synchronization across VHR and Sticker in isolated sessions.
 */
export class PlansSaveTagModule {
  private logger = new Logger('PlansSaveTagModule');

  constructor(
    private browser: Browser,
    private page: Page,
    private previewPage: PreviewPage,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  private async decodeFreshModernVin(previewType: PreviewType): Promise<string> {
    const vin = await this.previewCheckoutModule.openFreshModernVin(previewType);
    await expect(this.previewPage.header.packageAccessCta()).toBeEnabled();
    return vin;
  }

  private async waitForPlansReady(targetPreview: PreviewPage): Promise<void> {
    await targetPreview.header.enabledAccessRecordCta().waitFor({ state: 'visible' });
    await targetPreview.plans.planOptions().first().waitFor({ state: 'visible' });
    await expect(targetPreview.header.packageAccessCta()).toBeEnabled();
  }

  private isAlreadyAtCleanPreview(vin: string, previewType: PreviewType): boolean {
    try {
      const current = new URL(this.page.url());
      return (
        current.pathname.includes('/preview') &&
        current.searchParams.get('vin') === vin &&
        current.searchParams.get('type') === previewType &&
        !current.searchParams.get('offer')
      );
    } catch {
      return false;
    }
  }

  private validateBaselinePlans(
    previewType: PreviewType,
    basePlans: PlanOptionInfo[],
    subtitleMaxSave: number | null
  ): {
    baseNonSub: PlanOptionInfo[];
    baseSubs: PlanOptionInfo[];
    singleBase: PlanOptionInfo | undefined;
    baseRetailUnit: number;
    baselineCurrency: string;
  } {
    const baseNonSub = basePlans.filter((p) => !p.isSubscription);
    const baseSubs = basePlans.filter((p) => p.isSubscription);
    expect(baseNonSub.length, `${previewType} baseline should render at least 2 package plans`).toBeGreaterThanOrEqual(2);

    const baselineCurrency = basePlans.find((p) => p.currencyToken)?.currencyToken || '';
    const singleBase = baseNonSub.find((p) => p.count === 1);
    const lowestBase = [...baseNonSub].sort((a, b) => a.count - b.count)[0];
    const baseRetailUnit = singleBase
      ? singleBase.totalAmount
      : (lowestBase.strikeAmount ?? lowestBase.totalAmount) / lowestBase.count;

    for (const plan of baseNonSub) {
      if (baselineCurrency && plan.currencyToken) {
        expect(plan.currencyToken, `${previewType} baseline plan "${plan.label}" currency consistency`).toBe(
          baselineCurrency
        );
      }

      if (plan.count === 1) {
        expect(plan.savePercent, `${previewType} 1-unit plan without coupon should have no Save badge`).toBeNull();
        expect(plan.strikeAmount, `${previewType} 1-unit plan without coupon should have no strikethrough`).toBeNull();
        PriceParser.assertAmountClose(
          plan.unitAmount,
          plan.totalAmount,
          `${previewType} baseline 1-unit display vs total`,
          PriceParser.dynamicTolerance(plan.totalAmount, 0.01, 0.05)
        );
      } else {
        expect(plan.strikeAmount, `${previewType} baseline "${plan.label}" must show strikethrough retail`).not.toBeNull();
        expect(plan.totalAmount, `${previewType} baseline "${plan.label}" total < strike`).toBeLessThan(
          plan.strikeAmount!
        );

        const expectedRetail = baseRetailUnit * plan.count;
        PriceParser.assertAmountClose(
          plan.strikeAmount!,
          expectedRetail,
          `${previewType} baseline "${plan.label}" retail (${plan.count} x base unit)`,
          PriceParser.dynamicTolerance(expectedRetail, 0.005, 0.05)
        );

        const expectedSave = Math.round((1 - plan.totalAmount / plan.strikeAmount!) * 100);
        expect(plan.savePercent, `${previewType} baseline "${plan.label}" Save % badge`).not.toBeNull();
        expect(
          Math.abs(plan.savePercent! - expectedSave),
          `${previewType} baseline "${plan.label}" Save % badge=${plan.savePercent} vs formula=${expectedSave}`
        ).toBeLessThanOrEqual(1);

        const expectedPerUnit = plan.totalAmount / plan.count;
        PriceParser.assertAmountClose(
          plan.unitAmount,
          expectedPerUnit,
          `${previewType} baseline "${plan.label}" per-unit price`,
          PriceParser.dynamicTolerance(expectedPerUnit, 0.01, 0.05)
        );
      }
    }

    for (const sub of baseSubs) {
      expect(sub.savePercent, `${previewType} baseline subscription "${sub.label}" has no Save % badge`).toBeNull();
      expect(sub.strikeAmount, `${previewType} baseline subscription "${sub.label}" has no strikethrough`).toBeNull();
    }

    if (subtitleMaxSave !== null) {
      const maxBadge = Math.max(...baseNonSub.map((p) => p.savePercent ?? 0));
      expect(subtitleMaxSave, `${previewType} baseline subtitle max Save %`).toBe(maxBadge);
    }

    return { baseNonSub, baseSubs, singleBase, baseRetailUnit, baselineCurrency };
  }

  private findMatchedCouponSubscription(
    baseSub: PlanOptionInfo,
    index: number,
    couponSubs: PlanOptionInfo[]
  ): PlanOptionInfo {
    const norm = baseSub.label.trim().toLowerCase();
    return (
      couponSubs.find((s) => s.label.trim().toLowerCase() === norm) ??
      couponSubs[index]
    );
  }

  /**
   * Verifies dynamic Save % tags, retail strike math, currency conversion scaling,
   * compounded coupon discount, subscription exclusion, and CTA sync for one product type.
   */
  async verifyTypeWithAndWithoutCoupon(
    vin: string,
    previewType: PreviewType,
    offerCode: string
  ): Promise<PlansCouponComparisonResult> {
    this.logger.step(`Verify Plans Save % logic for type=${previewType} (No Coupon vs offer=${offerCode})`);

    if (!this.isAlreadyAtCleanPreview(vin, previewType)) {
      await this.previewPage.openDirectly(vin, previewType);
    }
    await this.waitForPlansReady(this.previewPage);

    const basePlans = await this.previewPage.plans.readAllPlans();
    const baseSub = await this.previewPage.plans.readSubtitleMaxSavePercent();
    const { baseNonSub, baseSubs, singleBase, baseRetailUnit, baselineCurrency } =
      this.validateBaselinePlans(previewType, basePlans, baseSub.maxSavePercent);

    const context = await BrowserSession.newContext(this.browser);

    try {
      const couponPage = await context.newPage();
      const couponPreview = new PreviewPage(couponPage);

      await couponPreview.openDirectly(vin, previewType, offerCode);
      await this.waitForPlansReady(couponPreview);

      const landedOffer = new URL(couponPage.url()).searchParams.get('offer');
      expect(landedOffer, `${previewType} URL should retain valid offer="${offerCode}"`).toBe(offerCode);

      const couponPlans = await couponPreview.plans.readAllPlans();
      const couponSub = await couponPreview.plans.readSubtitleMaxSavePercent();
      const couponNonSub = couponPlans.filter((p) => !p.isSubscription);
      const couponSubs = couponPlans.filter((p) => p.isSubscription);

      expect(couponNonSub.length, `${previewType} coupon session package plan count should match baseline`).toBe(
        baseNonSub.length
      );
      expect(couponSubs.length, `${previewType} coupon session subscription plan count should match baseline`).toBe(
        baseSubs.length
      );

      const couponCurrency = couponPlans.find((p) => p.currencyToken)?.currencyToken || '';
      const sameCurrency = Boolean(baselineCurrency && couponCurrency && baselineCurrency === couponCurrency);

      const singleCoupon = couponNonSub.find((p) => p.count === 1);
      let couponRetailUnit: number;
      let conversionFactor: number;
      let effectiveCouponRate: number;

      if (singleBase && singleCoupon) {
        expect(singleCoupon.savePercent, `${previewType} 1-unit plan with coupon must show Save %`).not.toBeNull();
        expect(singleCoupon.savePercent!, `${previewType} 1-unit Save % > 0`).toBeGreaterThan(0);
        expect(singleCoupon.strikeAmount, `${previewType} 1-unit with coupon must show strikethrough`).not.toBeNull();
        expect(singleCoupon.totalAmount).toBeLessThan(singleCoupon.strikeAmount!);

        effectiveCouponRate = 1 - singleCoupon.totalAmount / singleCoupon.strikeAmount!;
        conversionFactor = singleCoupon.strikeAmount! / singleBase.totalAmount;
        couponRetailUnit = singleCoupon.strikeAmount!;

        expect(
          Math.abs(singleCoupon.savePercent! - Math.round(effectiveCouponRate * 100)),
          `${previewType} 1-unit Save % matches derived coupon rate`
        ).toBeLessThanOrEqual(1);

        if (sameCurrency) {
          PriceParser.assertAmountClose(
            singleCoupon.strikeAmount!,
            singleBase.totalAmount,
            `${previewType} coupon 1-unit strikethrough matches baseline 1-unit price`,
            PriceParser.dynamicTolerance(singleBase.totalAmount, 0.005, 0.05)
          );
          expect(singleCoupon.totalAmount).toBeLessThan(singleBase.totalAmount);
        }
      } else {
        const anchorBase = [...baseNonSub].sort((a, b) => a.count - b.count)[0];
        const anchorCoupon = couponNonSub.find((c) => c.count === anchorBase.count);
        expect(anchorCoupon, `${previewType} anchor coupon plan missing for count=${anchorBase.count}`).toBeDefined();

        couponRetailUnit = (anchorCoupon!.strikeAmount ?? anchorCoupon!.totalAmount) / anchorCoupon!.count;
        conversionFactor = couponRetailUnit / baseRetailUnit;
        effectiveCouponRate = 1 - anchorCoupon!.totalAmount / (anchorBase.totalAmount * conversionFactor);
      }

      expect(effectiveCouponRate, `${previewType} derived coupon rate in (0, 1)`).toBeGreaterThan(0);
      expect(effectiveCouponRate, `${previewType} derived coupon rate < 1`).toBeLessThan(1);
      expect(conversionFactor, `${previewType} currency conversion factor > 0`).toBeGreaterThan(0);

      // Verify interactive CTA sync across every coupon plan card dynamically
      const ctaSyncedByIndex = new Map<number, number>();
      const couponCta = couponPreview.header.packageAccessCta();
      for (const plan of couponPlans) {
        await couponPreview.plans.selectPlanByIndex(plan.index);
        await expect(async () => {
          const parsed = PriceParser.parseLastPrice(await couponCta.innerText());
          PriceParser.assertAmountClose(
            parsed.amount,
            plan.totalAmount,
            `${previewType} coupon CTA price sync for "${plan.label}"`,
            PriceParser.dynamicTolerance(plan.totalAmount, 0.002, 0.02)
          );
          if (couponCurrency && parsed.currencyToken) {
            expect(parsed.currencyToken, `${previewType} CTA currency token consistency`).toBe(couponCurrency);
          }
          ctaSyncedByIndex.set(plan.index, parsed.amount);
        }).toPass();
      }

      const planChecks: PlanSaveCheckItem[] = [];

      for (const pBase of baseNonSub) {
        const pCoupon = couponNonSub.find((c) => c.count === pBase.count);
        expect(pCoupon, `${previewType} coupon session missing plan for count=${pBase.count}`).toBeDefined();
        if (!pCoupon) continue;

        expect(pCoupon.strikeAmount, `${previewType} coupon "${pCoupon.label}" strikethrough`).not.toBeNull();
        const expectedCouponStrike = couponRetailUnit * pCoupon.count;
        PriceParser.assertAmountClose(
          pCoupon.strikeAmount!,
          expectedCouponStrike,
          `${previewType} coupon "${pCoupon.label}" retail strike`,
          PriceParser.dynamicTolerance(expectedCouponStrike, 0.005, 0.05)
        );
        expect(pCoupon.totalAmount).toBeLessThan(pCoupon.strikeAmount!);

        const expectedCouponTotal = pBase.totalAmount * conversionFactor * (1 - effectiveCouponRate);
        PriceParser.assertAmountClose(
          pCoupon.totalAmount,
          expectedCouponTotal,
          `${previewType} coupon "${pCoupon.label}" discounted total`,
          PriceParser.dynamicTolerance(expectedCouponTotal, 0.01, 0.05)
        );

        if (sameCurrency) {
          expect(
            pCoupon.totalAmount,
            `${previewType} "${pCoupon.label}" coupon price < baseline price`
          ).toBeLessThan(pBase.totalAmount);
        }

        const expectedBaselineSavePercent = pBase.strikeAmount
          ? Math.round((1 - pBase.totalAmount / pBase.strikeAmount) * 100)
          : null;
        const expectedCouponSavePercent = Math.round((1 - pCoupon.totalAmount / pCoupon.strikeAmount!) * 100);
        const packDiscountRate = pBase.strikeAmount ? 1 - pBase.totalAmount / pBase.strikeAmount : 0;
        const expectedCompoundedSavePercent = Math.round(
          (1 - (1 - packDiscountRate) * (1 - effectiveCouponRate)) * 100
        );

        expect(pCoupon.savePercent, `${previewType} coupon "${pCoupon.label}" Save % badge`).not.toBeNull();
        expect(
          Math.abs(pCoupon.savePercent! - expectedCouponSavePercent),
          `${previewType} "${pCoupon.label}" coupon Save %=${pCoupon.savePercent} vs direct=${expectedCouponSavePercent}`
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(pCoupon.savePercent! - expectedCompoundedSavePercent),
          `${previewType} "${pCoupon.label}" coupon Save %=${pCoupon.savePercent} vs compounded=${expectedCompoundedSavePercent}`
        ).toBeLessThanOrEqual(1);
        expect(
          pCoupon.savePercent!,
          `${previewType} "${pCoupon.label}" Save % increased with coupon`
        ).toBeGreaterThan(pBase.savePercent ?? 0);

        const expectedPerUnit = pCoupon.totalAmount / pCoupon.count;
        PriceParser.assertAmountClose(
          pCoupon.unitAmount,
          expectedPerUnit,
          `${previewType} coupon "${pCoupon.label}" per-unit price`,
          PriceParser.dynamicTolerance(expectedPerUnit, 0.01, 0.05)
        );

        if (couponCurrency && pCoupon.currencyToken) {
          expect(pCoupon.currencyToken, `${previewType} "${pCoupon.label}" coupon currency token`).toBe(
            couponCurrency
          );
        }

        planChecks.push({
          label: pCoupon.label,
          count: pCoupon.count,
          isSubscription: false,
          baselineTotal: pBase.totalAmount,
          baselineStrike: pBase.strikeAmount,
          baselineSavePercent: pBase.savePercent,
          couponTotal: pCoupon.totalAmount,
          couponStrike: pCoupon.strikeAmount,
          couponSavePercent: pCoupon.savePercent,
          expectedBaselineSavePercent,
          expectedCouponSavePercent,
          expectedCompoundedSavePercent,
          expectedCouponTotal: Number(expectedCouponTotal.toFixed(2)),
          ctaSyncedAmount: ctaSyncedByIndex.get(pCoupon.index) ?? pCoupon.totalAmount,
          currencyToken: couponCurrency || baselineCurrency,
        });
      }

      for (let i = 0; i < baseSubs.length; i++) {
        const subBase = baseSubs[i];
        const subCoupon = this.findMatchedCouponSubscription(subBase, i, couponSubs);
        expect(subCoupon, `${previewType} coupon session missing subscription "${subBase.label}"`).toBeDefined();

        expect(subCoupon.savePercent, `${previewType} coupon subscription "${subCoupon.label}" Save badge`).toBeNull();
        expect(subCoupon.strikeAmount, `${previewType} coupon subscription "${subCoupon.label}" strike`).toBeNull();

        const expectedSubTotal = subBase.totalAmount * conversionFactor;
        PriceParser.assertAmountClose(
          subCoupon.totalAmount,
          expectedSubTotal,
          `${previewType} subscription "${subCoupon.label}" excluded from coupon discount`,
          PriceParser.dynamicTolerance(expectedSubTotal, 0.01, 0.05)
        );

        planChecks.push({
          label: subCoupon.label,
          count: 0,
          isSubscription: true,
          baselineTotal: subBase.totalAmount,
          baselineStrike: subBase.strikeAmount,
          baselineSavePercent: subBase.savePercent,
          couponTotal: subCoupon.totalAmount,
          couponStrike: subCoupon.strikeAmount,
          couponSavePercent: subCoupon.savePercent,
          expectedBaselineSavePercent: null,
          expectedCouponSavePercent: null,
          expectedCompoundedSavePercent: null,
          expectedCouponTotal: Number(expectedSubTotal.toFixed(2)),
          ctaSyncedAmount: ctaSyncedByIndex.get(subCoupon.index) ?? subCoupon.totalAmount,
          currencyToken: couponCurrency || baselineCurrency,
        });
      }

      if (couponSub.maxSavePercent !== null) {
        const maxCouponBadge = Math.max(...couponNonSub.map((p) => p.savePercent ?? 0));
        expect(couponSub.maxSavePercent, `${previewType} coupon subtitle max Save %`).toBe(maxCouponBadge);
      }
      if (baseSub.maxSavePercent !== null && couponSub.maxSavePercent !== null) {
        expect(couponSub.maxSavePercent, `${previewType} coupon subtitle max Save % > baseline`).toBeGreaterThan(
          baseSub.maxSavePercent
        );
      }

      this.logger.pass(
        `Verified type=${previewType} Save % matrix (${planChecks.length} plans, currency=${couponCurrency || baselineCurrency || 'N/A'}, couponRate=${(effectiveCouponRate * 100).toFixed(2)}%, conversionFactor=${conversionFactor.toFixed(4)})`
      );

      return {
        previewType,
        vin,
        offerCode,
        baselineCurrency,
        couponCurrency,
        conversionFactor: Number(conversionFactor.toFixed(6)),
        effectiveCouponRate: Number(effectiveCouponRate.toFixed(4)),
        baselineSubtitleMaxSave: baseSub.maxSavePercent,
        couponSubtitleMaxSave: couponSub.maxSavePercent,
        baselinePlanCount: basePlans.length,
        couponPlanCount: couponPlans.length,
        planChecks,
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Decodes one fresh Modern VIN cleanly and verifies Plans "Save %" logic & coupon math
   * across both VHR and Sticker in isolated sessions.
   */
  async verifyPlansSaveTagMatrix(offerCode = 'preview15'): Promise<PlansSaveTagMatrixResult> {
    const vin = await this.decodeFreshModernVin('vhr');
    const vhr = await this.verifyTypeWithAndWithoutCoupon(vin, 'vhr', offerCode);
    const sticker = await this.verifyTypeWithAndWithoutCoupon(vin, 'sticker', offerCode);

    return {
      vin,
      offerCode,
      vhr,
      sticker,
    };
  }
}
