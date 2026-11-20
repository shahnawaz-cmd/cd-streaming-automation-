import { test as base, expect } from '@playwright/test';
import { HomePage, PreviewPage, CheckoutPage, CdmaGaragePage } from '../pages';
import { BrowserSession } from '../utils/BrowserSession';
import {
  VinDecodeModule,
  FlowDetectionModule,
  EvidenceModule,
  ModernDecodeHandler,
  ClassicDecodeHandler,
  ExitIntentModule,
  EditYmmModule,
  EditSpecsModule,
  PreviewCheckoutModule,
  LanguageModule,
  ShortVinHandler,
  GarageModule,
  SiteSettingsModule,
  UpsellModule,
  PlanSelectionModule,
  CheckoutPriceSyncModule,
  RevisitBannerModule,
  PlansSaveTagModule,
  EmailCacheModule,
  TrackingCookieModule,
  DualCouponModule,
} from '../modules';

export type EnterpriseFixtures = {
  homePage: HomePage;
  previewPage: PreviewPage;
  checkoutPage: CheckoutPage;
  cdmaGaragePage: CdmaGaragePage;
  vinDecodeModule: VinDecodeModule;
  flowDetectionModule: FlowDetectionModule;
  evidenceModule: EvidenceModule;
  modernDecodeHandler: ModernDecodeHandler;
  classicDecodeHandler: ClassicDecodeHandler;
  exitIntentModule: ExitIntentModule;
  editYmmModule: EditYmmModule;
  editSpecsModule: EditSpecsModule;
  previewCheckoutModule: PreviewCheckoutModule;
  languageModule: LanguageModule;
  shortVinHandler: ShortVinHandler;
  garageModule: GarageModule;
  siteSettingsModule: SiteSettingsModule;
  upsellModule: UpsellModule;
  planSelectionModule: PlanSelectionModule;
  checkoutPriceSyncModule: CheckoutPriceSyncModule;
  revisitBannerModule: RevisitBannerModule;
  plansSaveTagModule: PlansSaveTagModule;
  emailCacheModule: EmailCacheModule;
  trackingCookieModule: TrackingCookieModule;
  dualCouponModule: DualCouponModule;
};

export const test = base.extend<EnterpriseFixtures>({
  page: async ({ page }, use) => {
    // Strip automation bot tag / webdriver signature
    await page.addInitScript(BrowserSession.stripWebdriver);

    await use(page);
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  previewPage: async ({ page }, use) => {
    await use(new PreviewPage(page));
  },

  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  cdmaGaragePage: async ({ page }, use) => {
    await use(new CdmaGaragePage(page));
  },

  vinDecodeModule: async ({ page, homePage, previewPage, classicDecodeHandler, evidenceModule }, use) => {
    await use(new VinDecodeModule(page, homePage, previewPage, classicDecodeHandler, evidenceModule));
  },

  flowDetectionModule: async ({ page }, use) => {
    await use(new FlowDetectionModule(page));
  },

  evidenceModule: async ({}, use) => {
    await use(new EvidenceModule());
  },

  modernDecodeHandler: async ({ previewPage }, use) => {
    await use(new ModernDecodeHandler(previewPage));
  },

  classicDecodeHandler: async ({ previewPage }, use) => {
    await use(new ClassicDecodeHandler(previewPage));
  },

  exitIntentModule: async ({ page, previewPage }, use) => {
    await use(new ExitIntentModule(page, previewPage));
  },

  editYmmModule: async ({ previewPage }, use) => {
    await use(new EditYmmModule(previewPage));
  },

  editSpecsModule: async ({ previewPage }, use) => {
    await use(new EditSpecsModule(previewPage));
  },

  previewCheckoutModule: async ({ page, previewPage, checkoutPage }, use) => {
    await use(new PreviewCheckoutModule(page, previewPage, checkoutPage));
  },

  languageModule: async (
    { page, previewPage, checkoutPage, previewCheckoutModule, vinDecodeModule, evidenceModule },
    use
  ) => {
    await use(
      new LanguageModule(page, previewPage, checkoutPage, previewCheckoutModule, vinDecodeModule, evidenceModule)
    );
  },

  shortVinHandler: async ({ previewPage, evidenceModule }, use) => {
    await use(new ShortVinHandler(previewPage, evidenceModule));
  },

  garageModule: async (
    { page, previewPage, cdmaGaragePage, vinDecodeModule, previewCheckoutModule, evidenceModule },
    use
  ) => {
    await use(
      new GarageModule(page, previewPage, cdmaGaragePage, vinDecodeModule, previewCheckoutModule, evidenceModule)
    );
  },

  siteSettingsModule: async ({ page }, use) => {
    await use(new SiteSettingsModule(page));
  },

  upsellModule: async ({ page, previewPage, classicDecodeHandler, previewCheckoutModule }, use) => {
    await use(new UpsellModule(page, previewPage, classicDecodeHandler, previewCheckoutModule));
  },

  planSelectionModule: async ({ previewPage, previewCheckoutModule }, use) => {
    await use(new PlanSelectionModule(previewPage, previewCheckoutModule));
  },

  checkoutPriceSyncModule: async ({ page, previewCheckoutModule, checkoutPage }, use) => {
    await use(new CheckoutPriceSyncModule(page, previewCheckoutModule, checkoutPage));
  },

  revisitBannerModule: async ({ browser, page, previewPage, homePage, previewCheckoutModule }, use) => {
    await use(new RevisitBannerModule(browser, page, previewPage, homePage, previewCheckoutModule));
  },

  plansSaveTagModule: async ({ browser, page, previewPage, previewCheckoutModule }, use) => {
    await use(new PlansSaveTagModule(browser, page, previewPage, previewCheckoutModule));
  },

  emailCacheModule: async ({ browser, page, previewPage, checkoutPage, previewCheckoutModule }, use) => {
    await use(new EmailCacheModule(browser, page, previewPage, checkoutPage, previewCheckoutModule));
  },

  trackingCookieModule: async ({ browser }, use) => {
    await use(new TrackingCookieModule(browser));
  },

  dualCouponModule: async ({ page, homePage, previewPage, previewCheckoutModule, exitIntentModule }, use) => {
    await use(new DualCouponModule(page, homePage, previewPage, previewCheckoutModule, exitIntentModule));
  },
});

export { expect };
