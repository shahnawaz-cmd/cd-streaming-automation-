import { test as base, expect } from '@playwright/test';
import { HomePage, PreviewPage, CheckoutPage } from '../pages';
import {
  VinDecodeModule,
  FlowDetectionModule,
  EvidenceModule,
  ModernDecodeHandler,
  ClassicDecodeHandler,
  ExitIntentModule,
} from '../modules';

export type EnterpriseFixtures = {
  homePage: HomePage;
  previewPage: PreviewPage;
  checkoutPage: CheckoutPage;
  vinDecodeModule: VinDecodeModule;
  flowDetectionModule: FlowDetectionModule;
  evidenceModule: EvidenceModule;
  modernDecodeHandler: ModernDecodeHandler;
  classicDecodeHandler: ClassicDecodeHandler;
  exitIntentModule: ExitIntentModule;
};

export const test = base.extend<EnterpriseFixtures>({
  page: async ({ page }, use) => {
    // Strip automation bot tag / webdriver signature
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

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

  vinDecodeModule: async ({ page, homePage, previewPage }, use) => {
    await use(new VinDecodeModule(page, homePage, previewPage));
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
});

export { expect };
