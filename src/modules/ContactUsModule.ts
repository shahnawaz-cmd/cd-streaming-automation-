import { Page, expect } from '@playwright/test';
import { ContactFormData, ContactUsPage } from '../pages/contact/ContactUsPage';
import { Logger } from '../utils/Logger';

export class ContactUsModule {
  private readonly logger = new Logger('ContactUsModule');

  constructor(private readonly page: Page, private readonly contactUsPage: ContactUsPage) {}

  /**
   * Verifies Contact page brand support channels, headings, and contact info.
   */
  async verifySupportChannels(): Promise<void> {
    await this.contactUsPage.open();

    const heading = this.page.locator('h1, h2').filter({ hasText: /contact/i }).first();
    await expect(heading, 'Contact Us heading visible').toBeVisible();

    const supportInfo = this.page.locator('body').filter({ hasText: /support@|help|contact/i });
    await expect(supportInfo, 'Support info/heading rendered').toBeVisible();

    this.logger.pass('Support channels and Contact Us headers are visible');
  }

  /**
   * Verifies reactive inline validation errors when clicking submit with empty fields.
   */
  async verifyEmptySubmissionValidation(): Promise<void> {
    await this.contactUsPage.open();
    await this.contactUsPage.submit();

    // Check for standard validation messages rendered reactively
    const requiredErrors = this.contactUsPage.contactForm().locator('p, span').filter({ hasText: /this field is required|enter an email address/i });
    await expect(requiredErrors.first(), 'Inline validation error visible').toBeVisible();
    
    const count = await requiredErrors.count();
    expect(count, 'At least 3 required validation messages appear').toBeGreaterThanOrEqual(3);

    this.logger.pass(`Empty form submission triggered ${count} validation errors as expected`);
  }

  /**
   * Verifies validation when an invalid email format is entered.
   */
  async verifyInvalidEmailValidation(): Promise<void> {
    await this.contactUsPage.open();
    await this.contactUsPage.emailInput().fill('invalid-email-format');
    await this.contactUsPage.submit();

    const invalidEmailError = this.contactUsPage.contactForm().locator('p, span').filter({ hasText: /invalid email address/i }).first();
    await expect(invalidEmailError, 'Invalid email error message visible').toBeVisible();

    this.logger.pass('Invalid email address validation error successfully verified');
  }

  /**
   * Verifies Concern dropdown options and selectable state.
   */
  async verifyConcernDropdownOptions(): Promise<string[]> {
    await this.contactUsPage.open();
    const trigger = this.contactUsPage.concernComboboxTrigger();
    await trigger.click();
    await expect(this.contactUsPage.concernListbox(), 'Concern listbox visible').toBeVisible();

    const options = await this.contactUsPage.allConcernOptions().allInnerTexts();
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);

    const expectedKeywords = [
      'General Inquiry',
      'Issue with the order',
      'Vehicle History Report Related Issue',
      'Build Sheet Related Issue',
      'Technical Support',
      'Other'
    ];

    for (const expected of expectedKeywords) {
      expect(cleanOptions.some(opt => opt.includes(expected)), `Listbox should include option "${expected}"`).toBeTruthy();
    }

    // Select one option to verify selectable state
    const targetOption = this.contactUsPage.concernOption('General Inquiry');
    await targetOption.click();
    await expect(this.contactUsPage.concernListbox(), 'Listbox closes after option selection').toBeHidden();
    await expect(trigger, 'Trigger displays selected value').toContainText('General Inquiry');

    this.logger.pass('Concern dropdown options and selection verified');
    return cleanOptions;
  }

  /**
   * Verifies form typing and input value retention.
   */
  async verifyFormTypingAndRetention(data: ContactFormData): Promise<void> {
    await this.contactUsPage.open();
    await this.contactUsPage.fillForm(data);

    await expect(this.contactUsPage.nameInput(), 'Name input retains value').toHaveValue(data.name);
    await expect(this.contactUsPage.emailInput(), 'Email input retains value').toHaveValue(data.email);
    if (data.mobile) {
      await expect(this.contactUsPage.mobileInput(), 'Mobile input retains value').toHaveValue(data.mobile);
    }
    if (data.concern) {
      await expect(this.contactUsPage.concernComboboxTrigger(), 'Concern trigger displays chosen text').toContainText(data.concern);
    }
    await expect(this.contactUsPage.messageTextarea(), 'Message textarea retains value').toHaveValue(data.message);

    this.logger.pass('Form inputs successfully retain entered values');
  }

  /**
   * Verifies submission dispatch and backend payload via route interception (prevents real spam).
   */
  async verifyMockedSubmissionAndPayload(data: ContactFormData): Promise<{
    url: string;
    payloadText: string;
  }> {
    await this.contactUsPage.open();

    let interceptedRequestUrl = '';
    let interceptedRequestBody = '';

    // Route interception for the contact submission endpoint
    await this.page.route('**/api_cwa/contact_mail**', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        interceptedRequestUrl = req.url();
        interceptedRequestBody = req.postData() || '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Message sent successfully' }),
        });
      } else {
        await route.continue();
      }
    });

    await this.contactUsPage.fillForm(data);

    // Wait for the request to be dispatched upon clicking submit
    const [request] = await Promise.all([
      this.page.waitForRequest(req => req.url().includes('api_cwa/contact_mail') && req.method() === 'POST'),
      this.contactUsPage.submit(),
    ]);

    expect(request, 'Backend contact mail request should have been dispatched').toBeTruthy();
    expect(interceptedRequestBody, 'Dispatched body should contain submitted name').toContain(data.name);
    expect(interceptedRequestBody, 'Dispatched body should contain submitted email').toContain(data.email);
    expect(interceptedRequestBody, 'Dispatched body should contain submitted message').toContain(data.message);

    this.logger.pass(`Form submission intercepted and verified for ${data.name}`);
    return {
      url: interceptedRequestUrl,
      payloadText: interceptedRequestBody,
    };
  }
}
