import { Logger } from '../utils/Logger';

const logger = new Logger('EmailGenerator');

/**
 * Layer 4: EmailGenerator
 * Generates realistic enterprise email addresses with a 2-digit randomized suffix
 * before the '@' symbol (e.g., shahnawaz47@empirepixel.com) to prevent bounce rate,
 * spam blacklisting, and duplicate email collisions.
 */
export class EmailGenerator {
  private static readonly DEFAULT_BASE = 'shahnawaz';
  private static readonly DEFAULT_DOMAIN = 'empirepixel.com';

  /**
   * Generates a unique 2-digit suffixed email.
   * Example: shahnawaz83@empirepixel.com
   *
   * @param base Username prefix (default: 'shahnawaz')
   * @param domain Domain name (default: 'empirepixel.com')
   */
  static generate(base = EmailGenerator.DEFAULT_BASE, domain = EmailGenerator.DEFAULT_DOMAIN): string {
    // 2-digit random number between 10 and 99
    const twoDigits = Math.floor(10 + Math.random() * 90);
    const email = `${base}${twoDigits}@${domain}`;
    logger.pass(`Generated unique test email: ${email}`);
    return email;
  }

  /**
   * Generates a timestamped email if high-volume parallel tests run simultaneously.
   */
  static generateWithTimestamp(base = EmailGenerator.DEFAULT_BASE, domain = EmailGenerator.DEFAULT_DOMAIN): string {
    const twoDigits = Math.floor(10 + Math.random() * 90);
    const ts = Date.now().toString().slice(-3);
    return `${base}${twoDigits}${ts}@${domain}`;
  }
}
