import { test, expect } from '../src/fixtures';

test.describe('Contact Us Verification Suite', () => {
  test.describe.configure({ mode: 'serial' });

  test(
    'TC-CONTACT-01: Verify brand support channels and Contact Us navigation',
    { tag: ['@contact', '@desktop', '@p0'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifySupportChannels();
    }
  );

  test(
    'TC-CONTACT-02: Verify empty form submission triggers inline validation errors',
    { tag: ['@contact', '@validation'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifyEmptySubmissionValidation();
    }
  );

  test(
    'TC-CONTACT-03: Verify invalid email format triggers inline error',
    { tag: ['@contact', '@validation'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifyInvalidEmailValidation();
    }
  );

  test(
    'TC-CONTACT-04: Verify Concern dropdown option parity and selectable states',
    { tag: ['@contact', '@dropdown'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifyConcernDropdownOptions();
    }
  );

  test(
    'TC-CONTACT-05: Verify self-healing form input typing and value retention',
    { tag: ['@contact', '@form-fill'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifyFormTypingAndRetention({
        name: 'QA Automation Engineer',
        email: 'qa.automation@empirepixel.com',
        mobile: '+1234567890',
        concern: 'General Inquiry',
        message: 'Automated test verification of contact form input responsiveness.',
      });
    }
  );

  test(
    'TC-CONTACT-06: Verify form submission and backend payload dispatch (QA Route Mocking)',
    { tag: ['@contact', '@backend-payload', '@submission'] },
    async ({ contactUsModule }) => {
      await contactUsModule.verifyMockedSubmissionAndPayload({
        name: 'QA Automation Engineer',
        email: 'qa.automation@empirepixel.com',
        mobile: '+1234567890',
        concern: 'General Inquiry',
        message: 'Verifying backend server action receives complete form submission payload.',
      });
    }
  );
});
