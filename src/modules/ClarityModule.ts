import { Browser, expect, Page } from '@playwright/test';
import { HomePage } from '../pages/home';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ExitIntentModalComponent } from '../pages/preview/ExitIntentModalComponent';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { ClarityTarget } from '../config/env';
import { BrowserSession } from '../utils/BrowserSession';
import { Logger } from '../utils/Logger';

type ClarityStage = 'HOME' | 'PREVIEW' | 'CHECKOUT';

export interface ClarityStageSnapshot {
  stage: ClarityStage;
  url: string;
  clck: string;
  clskCookiePresent: boolean;
  collectRequests: number;
}

export interface ClarityJourneyResult {
  environment: ClarityTarget['name'];
  baseURL: string;
  projectId: string;
  vin: string;
  stages: ClarityStageSnapshot[];
}

/**
 * Layer 3: ClarityModule
 * Verifies the Microsoft Clarity wrapper survives the full funnel (Home -> Preview -> Checkout):
 * project tag loaded, `window.clarity` ready, `_clck`/`_clsk` cookies present, `/collect` beacons flowing,
 * and the same Clarity user (`_clck`) on every page. Each environment runs in its own isolated session.
 */
export class ClarityModule {
  private logger = new Logger('ClarityModule');

  constructor(private browser: Browser) {}

  verifyJourney(target: ClarityTarget): Promise<ClarityJourneyResult> {
    return BrowserSession.withPage(
      this.browser,
      async (page) => {
        // Clarity /collect beacons, attributed to the page path (/, /preview, /checkout) that sent them
        const beaconsByPath = new Map<string, number>();
        page.on('request', (req) => {
          if (req.method() !== 'POST' || !/clarity\.ms\/collect/i.test(req.url())) return;
          const path = new URL(req.frame().url()).pathname;
          beaconsByPath.set(path, (beaconsByPath.get(path) ?? 0) + 1);
        });

        const home = new HomePage(page);
        const preview = new PreviewPage(page);
        const checkout = new CheckoutPage(page);
        const flow = new PreviewCheckoutModule(page, preview, checkout);
        const stages: ClarityStageSnapshot[] = [];
        const record = async (stage: ClarityStage): Promise<void> => {
          stages.push(await this.assertClarityActive(page, target, stage, beaconsByPath, stages[0]?.clck));
        };

        await home.navigate('/');
        await home.hero.vinInput().waitFor({ state: 'visible' });
        await record('HOME');

        const vin = await flow.decodeFreshModernVin(async (candidate) => {
          await home.navigate('/');
          await home.fillVin(candidate);
          await home.clickSubmit();
          await home.waitForPreviewRedirect(candidate);
        });
        await record('PREVIEW');

        await ExitIntentModalComponent.runWithOverlayGuard(page, () => flow.proceedToCheckoutViaAccessCta());
        await record('CHECKOUT');

        this.logger.pass(`${target.name}: Clarity (${target.projectId}) active on HOME -> PREVIEW -> CHECKOUT`);
        return {
          environment: target.name,
          baseURL: target.baseURL,
          projectId: target.projectId,
          vin,
          stages,
        };
      },
      { baseURL: target.baseURL }
    );
  }

  private async cookieValue(page: Page, name: string): Promise<string | undefined> {
    return (await page.context().cookies()).find((c) => c.name === name)?.value;
  }

  /** Asserts Clarity is fully active on the current page and returns a snapshot for evidence. */
  private async assertClarityActive(
    page: Page,
    target: ClarityTarget,
    stage: ClarityStage,
    beaconsByPath: Map<string, number>,
    firstClck?: string
  ): Promise<ClarityStageSnapshot> {
    const label = `${target.name} ${stage}`;
    const pagePath = new URL(page.url()).pathname;
    const beacons = (): number => beaconsByPath.get(pagePath) ?? 0;

    await expect(
      page.locator(`script[src*="clarity.ms/tag/${target.projectId}"]`).first(),
      `${label}: Clarity project tag ${target.projectId} in DOM`
    ).toBeAttached();
    await expect
      .poll(() => page.evaluate(() => typeof (window as unknown as { clarity?: unknown }).clarity), {
        message: `${label}: window.clarity ready`,
      })
      .toBe('function');
    await expect
      .poll(() => this.cookieValue(page, '_clck'), { message: `${label}: _clck cookie` })
      .toBeTruthy();
    await expect
      .poll(() => this.cookieValue(page, '_clsk'), { message: `${label}: _clsk cookie` })
      .toBeTruthy();
    await expect
      .poll(beacons, { message: `${label}: Clarity /collect beacon sent from ${pagePath}` })
      .toBeGreaterThan(0);

    const clck = (await this.cookieValue(page, '_clck'))!;
    if (firstClck) expect(clck, `${label}: same Clarity user (_clck) as HOME`).toBe(firstClck);

    return { stage, url: page.url().split('?')[0], clck, clskCookiePresent: true, collectRequests: beacons() };
  }
}
