import { expect, Page } from '@playwright/test';
import { Logger } from '../utils/Logger';

export interface SiteSettingsUpsellConfig {
  source: 'localStorage' | 'homepage_ssr_payload';
  stickerCheckboxText: string;
  reportCheckboxText: string;
  stickerCheckboxPrice: string | null;
  reportCheckboxPrice: string | null;
}

/**
 * Layer 3: SiteSettingsModule
 * Dynamically resolves live site_settings upsell configuration:
 * checks localStorage ('site_settings' / 'site_setting') first and falls back to
 * the live Next.js SSR payload when storage is not yet hydrated client-side.
 */
export class SiteSettingsModule {
  private logger = new Logger('SiteSettingsModule');

  constructor(private page: Page) {}

  private extractRscString(rawHtml: string, key: string): string | null {
    const plainMatch = rawHtml.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
    if (plainMatch) {
      try {
        return JSON.parse(`"${plainMatch[1]}"`) as string;
      } catch {
        return plainMatch[1];
      }
    }

    const escapedMatch = rawHtml.match(
      new RegExp(`\\\\"${key}\\\\"\\s*:\\s*\\\\"([\\s\\S]*?)\\\\"`)
    );
    if (escapedMatch) {
      return escapedMatch[1]
        .replace(/\\\\"/g, '"')
        .replace(/\\u0026/g, '&')
        .trim();
    }

    return null;
  }

  private async tryReadFromLocalStorage(): Promise<Omit<SiteSettingsUpsellConfig, 'source'> | null> {
    if (!this.page.url() || this.page.url() === 'about:blank') return null;

    const raw = await this.page
      .evaluate(() => {
        for (const key of ['site_settings', 'site_setting']) {
          const val = localStorage.getItem(key);
          if (!val) continue;
          try {
            const parsed = JSON.parse(val);
            const data = parsed?.data ?? parsed;
            if (
              data?.sticker_preview_page_checkbox_text &&
              data?.report_preview_page_checkbox_text
            ) {
              return {
                stickerCheckboxText: String(data.sticker_preview_page_checkbox_text).trim(),
                reportCheckboxText: String(data.report_preview_page_checkbox_text).trim(),
                stickerCheckboxPrice: data.sticker_preview_page_checkbox_price
                  ? String(data.sticker_preview_page_checkbox_price)
                  : null,
                reportCheckboxPrice: data.report_preview_page_checkbox_price
                  ? String(data.report_preview_page_checkbox_price)
                  : null,
              };
            }
          } catch {
            // ignore malformed storage entry
          }
        }
        return null;
      })
      .catch(() => null);

    return raw;
  }

  /**
   * Resolves site_settings preview checkbox configuration dynamically from live app state.
   */
  async resolveSiteSettings(): Promise<SiteSettingsUpsellConfig> {
    const fromLs = await this.tryReadFromLocalStorage();
    if (fromLs) {
      this.logger.pass(
        `Resolved site_settings from localStorage: sticker="${fromLs.stickerCheckboxText.slice(0, 48)}..."`
      );
      return { source: 'localStorage', ...fromLs };
    }

    const res = await this.page.request.get('/');
    expect(res.ok(), 'Expected Homepage SSR response to resolve site_settings').toBe(true);
    const html = await res.text();

    const stickerCheckboxText = (this.extractRscString(html, 'sticker_preview_page_checkbox_text') || '').trim();
    const reportCheckboxText = (this.extractRscString(html, 'report_preview_page_checkbox_text') || '').trim();
    const stickerCheckboxPrice = this.extractRscString(html, 'sticker_preview_page_checkbox_price');
    const reportCheckboxPrice = this.extractRscString(html, 'report_preview_page_checkbox_price');

    expect(
      stickerCheckboxText.length,
      'sticker_preview_page_checkbox_text should be present in live site_settings'
    ).toBeGreaterThan(0);
    expect(
      reportCheckboxText.length,
      'report_preview_page_checkbox_text should be present in live site_settings'
    ).toBeGreaterThan(0);

    this.logger.pass(
      `Resolved site_settings from Homepage SSR payload: sticker="${stickerCheckboxText.slice(0, 48)}..." | report="${reportCheckboxText.slice(0, 48)}..."`
    );

    return {
      source: 'homepage_ssr_payload',
      stickerCheckboxText,
      reportCheckboxText,
      stickerCheckboxPrice,
      reportCheckboxPrice,
    };
  }
}
