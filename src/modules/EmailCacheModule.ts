import { Browser, expect, Page } from '@playwright/test';
import { PreviewPage } from '../pages/preview/PreviewPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { CdmaGaragePage } from '../pages/cdma/CdmaGaragePage';
import { ExitIntentModalComponent } from '../pages/preview/ExitIntentModalComponent';
import { PreviewCheckoutModule } from './PreviewCheckoutModule';
import { EmailGenerator } from '../data/EmailGenerator';
import { GarageCredentialsGenerator } from '../data/GarageCredentialsGenerator';
import { BrowserSession } from '../utils/BrowserSession';
import { Logger } from '../utils/Logger';

/** sessionStorage key the Preview page uses to cache the delivery email (per tab/session). */
export const PREVIEW_EMAIL_CACHE_KEY = '__cd_pvw_email';

export interface EmailCacheCheck {
  step: string;
  vin: string;
  expectedEmail: string;
  inputValue: string;
  cachedValue: string | null;
  checkoutPayloadEmail?: string;
}

export interface EmailCacheScenarioResult {
  scenario: 'SAME_SESSION' | 'NEW_SESSION' | 'LOGGED_IN';
  email: string;
  checks: EmailCacheCheck[];
  validation?: { empty: string; invalid: string };
}

/** Page-scoped bundle so the same flows run in the fixture page or in a fresh browser context. */
interface PreviewSession {
  page: Page;
  preview: PreviewPage;
  checkout: CheckoutPage;
  flow: PreviewCheckoutModule;
}

/**
 * Layer 3: EmailCacheModule
 * Preview delivery-email cache logic:
 * - Same session: submitted email is cached (sessionStorage) and prefilled for every VIN until the session closes.
 * - New session: no prefill; empty / malformed email is blocked on Preview.
 * - Logged-in: account email is auto-filled and the CTA goes straight to Checkout.
 * Native Playwright only: config-driven timeouts, web-first assertions, locator.or() self-healing POM.
 */
export class EmailCacheModule {
  private logger = new Logger('EmailCacheModule');

  constructor(
    private browser: Browser,
    private page: Page,
    private previewPage: PreviewPage,
    private checkoutPage: CheckoutPage,
    private previewCheckoutModule: PreviewCheckoutModule
  ) {}

  private get fixtureSession(): PreviewSession {
    return { page: this.page, preview: this.previewPage, checkout: this.checkoutPage, flow: this.previewCheckoutModule };
  }

  /** Runs `action` in a brand-new browser context (fresh cookies + sessionStorage), always closing it. */
  private async inNewSession<T>(action: (s: PreviewSession) => Promise<T>): Promise<T> {
    const context = await BrowserSession.newContext(this.browser);
    try {
      const page = await context.newPage();
      const preview = new PreviewPage(page);
      const checkout = new CheckoutPage(page);
      return await action({ page, preview, checkout, flow: new PreviewCheckoutModule(page, preview, checkout) });
    } finally {
      await context.close();
    }
  }

  private decodeFreshModernVin(s: PreviewSession): Promise<string> {
    return s.flow.openFreshModernVin('vhr');
  }

  private readCachedEmail(s: PreviewSession): Promise<string | null> {
    return s.page.evaluate((key) => sessionStorage.getItem(key), PREVIEW_EMAIL_CACHE_KEY);
  }

  private clickPackageCta(s: PreviewSession): Promise<void> {
    return ExitIntentModalComponent.runWithOverlayGuard(s.page, () => s.preview.header.packageAccessCta().click());
  }

  /** Asserts the (possibly collapsed) delivery email input holds the expected value. */
  private async expectPrefilled(s: PreviewSession, vin: string, step: string, expected: string): Promise<EmailCacheCheck> {
    const input = s.preview.header.deliveryEmailInput();
    await expect(input, `${step}: delivery email value`).toHaveValue(expected);
    return { step, vin, expectedEmail: expected, inputValue: await input.inputValue(), cachedValue: await this.readCachedEmail(s) };
  }

  private expectCheckoutPayload(s: PreviewSession, vin: string, expectedEmail: string): string {
    const payload = s.checkout.readDecodedPayload();
    expect(payload?.vin, 'Checkout payload vin').toBe(vin);
    expect(payload?.email, 'Checkout payload email').toBe(expectedEmail);
    return payload!.email!;
  }

  /** Clicks the Package CTA without touching the email field and asserts direct landing on Checkout. */
  private async checkoutWithoutTyping(s: PreviewSession, vin: string, expectedEmail: string): Promise<string> {
    await this.clickPackageCta(s);
    await s.checkout.verifyLandedOnCheckout();
    return this.expectCheckoutPayload(s, vin, expectedEmail);
  }

  /** Reveals the delivery email input (first CTA click expands the accordion when collapsed). */
  private async revealEmailInput(s: PreviewSession): Promise<void> {
    const input = s.preview.header.deliveryEmailInput();
    if (await input.isVisible()) return;
    await this.clickPackageCta(s);
    await expect(input).toBeVisible();
  }

  /** Submits the given email and asserts Preview blocks navigation with an invalid-field state. */
  private async expectBlocked(s: PreviewSession, value: string): Promise<string> {
    const input = s.preview.header.deliveryEmailInput();
    await input.fill(value);
    await this.clickPackageCta(s);
    await expect(input, `Email "${value}" should be flagged invalid`).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    await expect(s.page, `Email "${value}" must not reach Checkout`).not.toHaveURL(/\/checkout/);
    return (await input.evaluate((el: HTMLInputElement) => el.validationMessage)) || 'aria-invalid=true';
  }

  /**
   * Same session: email entered once is cached and prefilled on back-navigation, reload,
   * and a different VIN in the same tab — CTA then goes straight to Checkout with the cached email.
   */
  async verifySameSessionPrefill(): Promise<EmailCacheScenarioResult> {
    const s = this.fixtureSession;
    const checks: EmailCacheCheck[] = [];

    const vin1 = await this.decodeFreshModernVin(s);
    expect(await this.readCachedEmail(s), 'No cached email before first submission').toBeNull();

    const { usedEmail } = await ExitIntentModalComponent.runWithOverlayGuard(s.page, () =>
      s.flow.proceedToCheckoutViaAccessCta(EmailGenerator.generateWithTimestamp())
    );
    const payloadEmail = this.expectCheckoutPayload(s, vin1, usedEmail);
    expect(await this.readCachedEmail(s), `sessionStorage.${PREVIEW_EMAIL_CACHE_KEY}`).toBe(usedEmail);
    checks.push({ step: 'Submit email -> Checkout', vin: vin1, expectedEmail: usedEmail, inputValue: usedEmail, cachedValue: usedEmail, checkoutPayloadEmail: payloadEmail });

    await s.page.goBack();
    checks.push(await this.expectPrefilled(s, vin1, 'Back to Preview', usedEmail));

    await s.page.reload();
    checks.push(await this.expectPrefilled(s, vin1, 'Reload Preview', usedEmail));

    const vin2 = await this.decodeFreshModernVin(s);
    const vin2Check = await this.expectPrefilled(s, vin2, 'Different VIN, same session', usedEmail);
    vin2Check.checkoutPayloadEmail = await this.checkoutWithoutTyping(s, vin2, usedEmail);
    checks.push(vin2Check);

    this.logger.pass(`Same-session email cache verified (${usedEmail}) across ${checks.length} steps`);
    return { scenario: 'SAME_SESSION', email: usedEmail, checks };
  }

  /**
   * New session: no cached email; empty and malformed emails are blocked,
   * and a fresh valid email reaches Checkout.
   */
  verifyNewSessionValidation(): Promise<EmailCacheScenarioResult> {
    return this.inNewSession(async (s) => {
      const vin = await this.decodeFreshModernVin(s);
      const fresh = await this.expectPrefilled(s, vin, 'New session, no prefill', '');
      expect(fresh.cachedValue, 'No cached email in new session').toBeNull();

      await this.revealEmailInput(s);
      const empty = await this.expectBlocked(s, '');
      const invalid = await this.expectBlocked(s, 'invalid-email');

      const email = EmailGenerator.generateWithTimestamp();
      await s.preview.header.deliveryEmailInput().fill(email);
      await this.clickPackageCta(s);
      await s.checkout.verifyLandedOnCheckout();
      const payloadEmail = this.expectCheckoutPayload(s, vin, email);

      this.logger.pass(`New-session validation verified: empty & invalid blocked, ${email} accepted`);
      return {
        scenario: 'NEW_SESSION',
        email,
        checks: [
          fresh,
          { step: 'Valid email -> Checkout', vin, expectedEmail: email, inputValue: email, cachedValue: await this.readCachedEmail(s), checkoutPayloadEmail: payloadEmail },
        ],
        validation: { empty, invalid },
      };
    });
  }

  /**
   * Logged-in (isolated session, so no guest email cache can mask the result): after Signup via
   * Add to Garage, Preview auto-fills the account email and the CTA goes straight to Checkout.
   */
  verifyLoggedInAutofill(): Promise<EmailCacheScenarioResult> {
    return this.inNewSession(async (s) => {
      const creds = GarageCredentialsGenerator.generate();

      await this.decodeFreshModernVin(s);
      await s.preview.addToGarage.completeSignup(creds);
      await new CdmaGaragePage(s.page).waitForDefaultAutoNavigation();

      const vin = await this.decodeFreshModernVin(s);
      const check = await this.expectPrefilled(s, vin, 'Logged-in Preview autofill', creds.email);
      check.checkoutPayloadEmail = await this.checkoutWithoutTyping(s, vin, creds.email);

      this.logger.pass(`Logged-in autofill & direct Checkout verified for ${creds.email}`);
      return { scenario: 'LOGGED_IN', email: creds.email, checks: [check] };
    });
  }
}
