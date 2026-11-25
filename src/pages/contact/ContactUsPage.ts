import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

export interface ContactFormData {
  name: string;
  email: string;
  mobile?: string;
  concern?: string;
  message: string;
}

export class ContactUsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.navigate('/contact-us');
    await this.page.waitForLoadState('networkidle');
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(this.contactForm(), 'Contact Us form visible').toBeVisible();
    await expect(this.submitButton(), 'Contact Us Submit button visible').toBeVisible();
  }

  contactForm(): Locator {
    return this.page.locator('form').filter({ has: this.page.locator('input[name="email"]') }).first();
  }

  nameInput(): Locator {
    return this.contactForm().locator('input[name="name"], input[placeholder*="Name" i]').first();
  }

  emailInput(): Locator {
    return this.contactForm().locator('input[name="email"], input[type="email"]').first();
  }

  mobileInput(): Locator {
    return this.contactForm().locator('input[name="mobile"], input[placeholder*="Phone" i]').first();
  }

  concernComboboxTrigger(): Locator {
    return this.contactForm().locator('button[role="combobox"]').first();
  }

  concernListbox(): Locator {
    return this.page.locator('[role="listbox"]').first();
  }

  concernOption(labelOrPattern: string | RegExp): Locator {
    return this.concernListbox().locator('[role="option"]').filter({ hasText: labelOrPattern }).first();
  }

  allConcernOptions(): Locator {
    return this.concernListbox().locator('[role="option"]');
  }

  messageTextarea(): Locator {
    return this.contactForm().locator('textarea[name="message"], textarea[placeholder*="Message" i]').first();
  }

  submitButton(): Locator {
    return this.page.getByRole('button', { name: 'Submit', exact: true });
  }

  async selectConcern(concernText: string | RegExp): Promise<void> {
    const trigger = this.concernComboboxTrigger();
    await trigger.click();
    await expect(this.concernListbox(), 'Concern listbox visible').toBeVisible();
    const option = this.concernOption(concernText);
    await expect(option, `Option matching ${concernText} visible`).toBeVisible();
    await option.click();
    await expect(this.concernListbox(), 'Concern listbox closed').toBeHidden();
  }

  async fillForm(data: ContactFormData): Promise<void> {
    await this.nameInput().fill(data.name);
    await this.emailInput().fill(data.email);
    if (data.mobile) {
      await this.mobileInput().fill(data.mobile);
    }
    if (data.concern) {
      await this.selectConcern(data.concern);
    }
    await this.messageTextarea().fill(data.message);
  }

  async submit(): Promise<void> {
    const btn = this.contactForm().locator('button[type="submit"]').or(this.page.getByRole('button', { name: 'Submit', exact: true })).first();
    await btn.evaluate((el: HTMLElement) => {
      const form = el.closest('form');
      if (form && !form.getAttribute('action')) {
        form.onsubmit = (e) => e.preventDefault();
      }
      el.click();
    });
  }
}
