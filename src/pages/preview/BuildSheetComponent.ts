import { Page, Locator } from '@playwright/test';

/**
 * BuildSheetComponent
 * Encapsulates Build Sheet specifications table, engine details, and factory packages.
 */
export class BuildSheetComponent {
  constructor(private page: Page) {}

  container = (): Locator =>
    this.page.locator('[data-testid="build-sheet"], section:has-text("Build Sheet")').first();

  specsTable = (): Locator =>
    this.page.locator('[data-testid="specs-table"], .specs-grid').first();

  engineSpec = (): Locator =>
    this.page.locator('text=/Engine/i >> xpath=..').first();

  transmissionSpec = (): Locator =>
    this.page.locator('text=/Transmission/i >> xpath=..').first();

  driveTypeSpec = (): Locator =>
    this.page.locator('text=/Drive Type/i >> xpath=..').first();
}
