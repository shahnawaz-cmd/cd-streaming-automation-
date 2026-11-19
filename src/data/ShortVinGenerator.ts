import { Logger } from '../utils/Logger';

const logger = new Logger('ShortVinGenerator');

const SHORT_VIN_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

/**
 * Layer 4: ShortVinGenerator
 * Generates random malformed short VINs (< 5 characters: length 1-4)
 * using characters A-Z and 1-9 (excluding 0) for direct Preview URL negative validation.
 */
export class ShortVinGenerator {
  static generate(length?: number): string {
    const targetLength =
      length !== undefined ? length : Math.floor(Math.random() * 4) + 1;

    if (targetLength < 1 || targetLength > 4) {
      throw new Error(
        `[ShortVinGenerator] Invalid short VIN length: ${targetLength}. Must be between 1 and 4.`
      );
    }

    let vin = '';
    for (let i = 0; i < targetLength; i++) {
      vin += SHORT_VIN_CHARSET.charAt(
        Math.floor(Math.random() * SHORT_VIN_CHARSET.length)
      );
    }

    logger.info(`Generated short invalid VIN (<5 chars, len=${targetLength}): ${vin}`);
    return vin;
  }
}
