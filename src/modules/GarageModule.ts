import { expect, Page, Response, TestInfo } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CdmaGaragePage } from '../pages/cdma/CdmaGaragePage';
import { VinDecodeModule } from './VinDecodeModule';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import type { EvidenceModule } from './EvidenceModule';
import { GarageCredentialsGenerator, GarageUserCredentials } from '../data/GarageCredentialsGenerator';
import { VinGenerator } from '../data/VinGenerator';
import { Logger } from '../utils/Logger';

export interface GarageApiVehicle {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
}

export interface GarageFlowResult {
  authFlow: 'SIGNUP' | 'LOGIN';
  email: string;
  vin: string;
  verifiedVinsInCdma: string[];
  postGarageStatus: number;
  postGarageResponse: unknown;
  getUserGarageStatus: number;
  getUserGarageResponse: unknown;
  apiVehicles: GarageApiVehicle[];
  cdmaUrl: string;
  cdmaTitle: string;
  navLinks: string[];
}

export interface GarageSignupContext {
  creds: GarageUserCredentials;
  result: GarageFlowResult;
}

/**
 * Layer 3: GarageModule
 * Orchestrates Add to Garage -> Signup & Login -> Default CDMA Auto-Navigation workflows,
 * validating Garage API persistence (POST /api/garage, GET /api/user/garage) and My Reports.
 * Strictly zero static timeouts and zero manual goto('/members/my-garage').
 */
export class GarageModule {
  private logger = new Logger('GarageModule');

  constructor(
    private page: Page,
    private previewPage: PreviewPage,
    private cdmaGaragePage: CdmaGaragePage,
    private vinDecodeModule: VinDecodeModule,
    private previewCheckoutModule: PreviewCheckoutModule,
    private evidenceModule: EvidenceModule
  ) {}

  private waitForGarageApiResponses(): {
    postGaragePromise: Promise<Response>;
    getUserGaragePromise: Promise<Response>;
  } {
    const postGaragePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/garage') &&
        !res.url().includes('/api/user/garage') &&
        res.request().method() === 'POST'
    );
    const getUserGaragePromise = this.page.waitForResponse(
      (res) => res.url().includes('/api/user/garage') && res.request().method() === 'GET'
    );
    return { postGaragePromise, getUserGaragePromise };
  }

  private async assertGarageApiResponses(
    authFlow: 'SIGNUP' | 'LOGIN',
    postGaragePromise: Promise<Response>,
    getUserGaragePromise: Promise<Response>,
    expectedVins: string[]
  ): Promise<{
    postGarageStatus: number;
    postGarageResponse: unknown;
    getUserGarageStatus: number;
    getUserGarageResponse: unknown;
    apiVehicles: GarageApiVehicle[];
  }> {
    const [postRes, getRes] = await Promise.all([postGaragePromise, getUserGaragePromise]);
    const postGarageStatus = postRes.status();
    const getUserGarageStatus = getRes.status();

    expect(postGarageStatus, 'POST /api/garage HTTP status').toBe(200);
    expect(getUserGarageStatus, 'GET /api/user/garage HTTP status').toBe(200);

    const postGarageResponse = await postRes.json().catch(async () => postRes.text().catch(() => null));
    const getUserGarageResponse = await getRes.json().catch(async () => getRes.text().catch(() => null));

    const json = (getUserGarageResponse && typeof getUserGarageResponse === 'object'
      ? getUserGarageResponse
      : {}) as {
      data?: { vehicles?: Array<Record<string, unknown>> };
    };
    const rawVehicles = Array.isArray(json?.data?.vehicles) ? json.data.vehicles : [];
    const apiVehicles: GarageApiVehicle[] = rawVehicles.map((v) => ({
      vin: String(v.vin || '').trim(),
      year: v.year !== undefined ? String(v.year) : undefined,
      make: v.make !== undefined ? String(v.make) : undefined,
      model: v.model !== undefined ? String(v.model) : undefined,
    }));

    const apiVins = apiVehicles.map((v) => v.vin);
    for (const expectedVin of expectedVins) {
      expect(
        apiVins,
        `Expected VIN ${expectedVin} in GET /api/user/garage payload: [${apiVins.join(', ')}]`
      ).toContain(expectedVin);
    }

    console.log(
      `[TC-10][${authFlow}] POST /api/garage (${postGarageStatus}):\n${JSON.stringify(postGarageResponse, null, 2)}`
    );
    console.log(
      `[TC-10][${authFlow}] GET /api/user/garage (${getUserGarageStatus}):\n${JSON.stringify(getUserGarageResponse, null, 2)}`
    );

    this.logger.pass(
      `Verified Garage API (POST=${postGarageStatus}, GET=${getUserGarageStatus}): vehicles=[${apiVins.join(', ')}]`
    );
    return {
      postGarageStatus,
      postGarageResponse,
      getUserGarageStatus,
      getUserGarageResponse,
      apiVehicles,
    };
  }

  private async decodeFreshModernVin(useDirectUrl = false): Promise<string> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const vin = await VinGenerator.modernFromMongo();
      if (useDirectUrl) {
        await this.vinDecodeModule.decodeDirectly(vin);
      } else {
        await this.vinDecodeModule.decodeFromHomepage(vin);
      }
      const outcome = await this.previewCheckoutModule.waitForLocalizedDecodeOutcome();
      if (outcome === 'DECODED') {
        this.logger.pass(`Decoded Modern VIN ${vin} cleanly on Preview (attempt ${attempt})`);
        return vin;
      }
      this.logger.warn(`Attempt ${attempt}/${maxAttempts}: Modern VIN ${vin} returned NOT_FOUND, retrying...`);
    }
    throw new Error(`[GarageModule] Failed to obtain a decoded Modern VIN after ${maxAttempts} attempts`);
  }

  /**
   * Decodes Modern VIN #1, signs up via Add to Garage modal, waits for default auto-navigation
   * into CDMA (/members/my-garage), and verifies Garage APIs + CDMA UI.
   */
  async addVehicleViaSignupAndVerifyCdma(): Promise<GarageSignupContext> {
    const creds = GarageCredentialsGenerator.generate();
    const vin = await this.decodeFreshModernVin(false);

    const { postGaragePromise, getUserGaragePromise } = this.waitForGarageApiResponses();
    await this.previewPage.addToGarage.completeSignup(creds);
    await this.cdmaGaragePage.waitForDefaultAutoNavigation();

    const apiProof = await this.assertGarageApiResponses('SIGNUP', postGaragePromise, getUserGaragePromise, [vin]);
    await this.cdmaGaragePage.verifyCdmaNavigationAndUser(creds.email);
    await this.cdmaGaragePage.verifyVehiclesSaved([vin]);

    const summary = await this.cdmaGaragePage.captureGarageSummary();
    return {
      creds,
      result: {
        authFlow: 'SIGNUP',
        email: creds.email,
        vin,
        verifiedVinsInCdma: [vin],
        ...apiProof,
        cdmaUrl: summary.url,
        cdmaTitle: summary.title,
        navLinks: summary.navLinks,
      },
    };
  }

  /**
   * Clears auth state, decodes Modern VIN #2, logs in with Signup credentials via Add to Garage modal,
   * and validates Garage APIs (both VINs) plus CDMA UI persistence after default auto-navigation.
   */
  async addVehicleViaLoginAndVerifyCdma(signupContext: GarageSignupContext): Promise<GarageFlowResult> {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const vin = await this.decodeFreshModernVin(true);

    const { postGaragePromise, getUserGaragePromise } = this.waitForGarageApiResponses();

    await this.previewPage.addToGarage.completeLogin(signupContext.creds);
    await this.cdmaGaragePage.waitForDefaultAutoNavigation();

    const expectedVins = [vin, signupContext.result.vin];
    const apiProof = await this.assertGarageApiResponses('LOGIN', postGaragePromise, getUserGaragePromise, expectedVins);

    await this.cdmaGaragePage.verifyCdmaNavigationAndUser(signupContext.creds.email);
    await this.cdmaGaragePage.verifyVehiclesSaved(expectedVins);

    const summary = await this.cdmaGaragePage.captureGarageSummary();

    return {
      authFlow: 'LOGIN',
      email: signupContext.creds.email,
      vin,
      verifiedVinsInCdma: expectedVins,
      ...apiProof,
      cdmaUrl: summary.url,
      cdmaTitle: summary.title,
      navLinks: summary.navLinks,
    };
  }

  /**
   * Captures CDMA screenshot & Garage API proof (no passwords), then closes the browser page cleanly.
   */
  async recordGarageCdmaProof(
    testInfo: TestInfo,
    signupResult: GarageFlowResult,
    loginResult: GarageFlowResult
  ): Promise<void> {
    await this.evidenceModule.recordGarageCdmaProof(testInfo, this.cdmaGaragePage, signupResult, loginResult);
    await this.page.close();
  }
}
