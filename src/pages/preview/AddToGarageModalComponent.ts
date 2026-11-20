import { expect, Locator, Page } from '@playwright/test';
import { GarageUserCredentials } from '../../data/GarageCredentialsGenerator';
import { Logger } from '../../utils/Logger';
import { ExitIntentModalComponent } from './ExitIntentModalComponent';

/**
 * Layer 2: AddToGarageModalComponent
 * 100% Native Playwright self-healing POM using official locator.or() chains.
 * Zero static timeouts — strictly web-first auto-retrying assertions.
 */
export class AddToGarageModalComponent {
  private logger = new Logger('AddToGarageModalComponent');

  constructor(private page: Page) {}

  trigger = (): Locator =>
    this.page
      .locator('header button:has-text("Add to garage")')
      .or(this.page.getByRole('button', { name: /Add to garage/i }))
      .or(this.page.locator('button:has-text("Add to Garage")'))
      .first();

  dialog = (): Locator =>
    this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('dialog'))
      .first();

  gatePrompt = (): Locator =>
    this.dialog()
      .getByText(/not logged in/i)
      .or(this.dialog().getByText(/Hey!/i))
      .or(this.dialog().getByRole('button', { name: /^Signup$/i }))
      .first();

  signupBtn = (): Locator =>
    this.dialog()
      .getByRole('button', { name: /^Signup$/i })
      .or(this.dialog().locator('button:text-is("Signup")'))
      .or(this.dialog().getByRole('button', { name: /Sign up/i }))
      .first();

  loginBtn = (): Locator =>
    this.dialog()
      .getByRole('button', { name: /^Login$/i })
      .or(this.dialog().locator('button:text-is("Login")'))
      .or(this.dialog().getByRole('button', { name: /Log in/i }))
      .first();

  emailInput = (): Locator =>
    this.dialog()
      .locator('input[name="email"]')
      .or(this.dialog().getByPlaceholder(/^Email$/i))
      .or(this.dialog().locator('input[type="email"]'))
      .first();

  signupPasswordInput = (): Locator =>
    this.dialog()
      .locator('input[name="password"]')
      .or(this.dialog().getByPlaceholder(/^Password$/i))
      .or(this.dialog().locator('input[type="password"]').first())
      .first();

  confirmPasswordInput = (): Locator =>
    this.dialog()
      .locator('input[name="confirmPassword"]')
      .or(this.dialog().getByPlaceholder(/Confirm Password/i))
      .or(this.dialog().locator('input[type="password"]').nth(1))
      .first();

  phoneInput = (): Locator =>
    this.dialog()
      .locator('input[name="phone"]')
      .or(this.dialog().getByPlaceholder(/^Phone$/i))
      .or(this.dialog().locator('input[type="tel"]'))
      .first();

  loginPasswordInput = (): Locator =>
    this.dialog()
      .locator('input[name="pass"]')
      .or(this.dialog().locator('input[name="password"]'))
      .or(this.dialog().getByPlaceholder(/^Password$/i))
      .or(this.dialog().locator('input[type="password"]'))
      .first();

  /**
   * Clicks Add to garage on Preview and asserts the unauthenticated gate modal opens.
   */
  async openGateModal(): Promise<void> {
    await ExitIntentModalComponent.runWithOverlayGuard(this.page, async () => {
      await expect(this.trigger()).toBeVisible();
      await expect(this.trigger()).toBeEnabled();
      await this.trigger().click();
      await expect(this.dialog()).toBeVisible();
      await expect(this.gatePrompt()).toBeVisible();
    });
  }

  /**
   * Opens Add to garage -> Signup form, fills fresh account credentials, and submits.
   * App automatically adds the VIN and navigates to CDMA after submission.
   */
  async completeSignup(creds: GarageUserCredentials): Promise<void> {
    await this.openGateModal();
    await this.signupBtn().click();

    await expect(this.confirmPasswordInput()).toBeVisible();
    await this.emailInput().fill(creds.email);
    await this.signupPasswordInput().fill(creds.password);
    await this.confirmPasswordInput().fill(creds.password);
    await this.phoneInput().fill(creds.phone);

    await expect(this.signupBtn()).toBeEnabled();
    await this.signupBtn().click();
    this.logger.info(`Submitted Add to Garage Signup for: ${creds.email}`);
  }

  /**
   * Opens Add to garage -> Login form, fills existing credentials, and submits.
   * App automatically adds the VIN and navigates to CDMA after submission.
   */
  async completeLogin(creds: GarageUserCredentials): Promise<void> {
    await this.openGateModal();
    await this.loginBtn().click();

    await expect(this.loginPasswordInput()).toBeVisible();
    await this.emailInput().fill(creds.email);
    await this.loginPasswordInput().fill(creds.password);

    await expect(this.loginBtn()).toBeEnabled();
    await this.loginBtn().click();
    this.logger.info(`Submitted Add to Garage Login for: ${creds.email}`);
  }
}
