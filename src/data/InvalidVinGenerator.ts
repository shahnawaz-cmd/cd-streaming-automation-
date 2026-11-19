import { Logger } from '../utils/Logger';

const logger = new Logger('InvalidVinGenerator');

/**
 * Layer 4: InvalidVinGenerator
 * Generates synthetic, un-decodable, and malformed VINs specifically for
 * verifying Fallback Handlers, Error Banners, and Negative Test Cases:
 *
 * 1. repeatedModern17(char): Generates 17-char repeated VINs (e.g., 17x 'A', 17x 'B')
 * 2. classicFallbackZero5(): Generates 5x '0' ("00000") to trigger Fallback 2 manual YMMT form
 * 3. malformedShort(val): Generates malformed short VINs (<5 chars, e.g., "ABC" for Checklist #30)
 * 4. randomIllegal17(): Generates randomized 17-char strings with illegal VIN chars (I, O, Q)
 */
export class InvalidVinGenerator {
  /**
   * Generates a 17-character repeated invalid Modern VIN.
   * If char is omitted, randomly picks a letter from 'A' to 'Z' on every run.
   * Example: 17x 'A' -> "AAAAAAAAAAAAAAAAA", 17x 'B' -> "BBBBBBBBBBBBBBBBB", ..., 17x 'Z' -> "ZZZZZZZZZZZZZZZZZ"
   * Triggers Modern Fallback 1: "We couldn't find a vehicle for this VIN" (CTA disabled)
   */
  static repeatedModern17(char?: string): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const singleChar = char ? char.charAt(0).toUpperCase() : letters.charAt(Math.floor(Math.random() * letters.length));
    const vin = singleChar.repeat(17);
    logger.info(`Generated 17-char invalid Modern VIN (${singleChar} x17): ${vin}`);
    return vin;
  }

  /**
   * Generates random letter from A-Z repeated 17 times on every run.
   */
  static randomRepeatedLetter17(): string {
    return this.repeatedModern17();
  }

  /**
   * Generates 17 random letters from A to Z (e.g. "KJHGFDSAMNBVCXZPO")
   */
  static randomLetters17(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 17; i++) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    logger.info(`Generated 17-char random letter VIN (A-Z): ${result}`);
    return result;
  }

  /**
   * Generates 17x 'A' ("AAAAAAAAAAAAAAAAA") for Checklist #31
   */
  static modern17A(): string {
    return this.repeatedModern17('A');
  }

  /**
   * Generates 17x 'B' ("BBBBBBBBBBBBBBBBB")
   */
  static modern17B(): string {
    return this.repeatedModern17('B');
  }

  /**
   * Generates a 5-digit repeated invalid Classic VIN with a random digit from 0 to 9 on every run.
   * If digit is omitted, picks a random digit from 0 to 9.
   * Example: 5x '0' -> "00000", 5x '1' -> "11111", ..., 5x '9' -> "99999"
   * Triggers Classic Fallback 2: "Update Your Vehicle Details" manual YMMT form
   */
  static repeatedClassic5(digit?: string): string {
    const digits = '0123456789';
    const singleDigit = digit ? digit.charAt(0) : digits.charAt(Math.floor(Math.random() * digits.length));
    const vin = singleDigit.repeat(5);
    logger.info(`Generated 5-digit Classic invalid VIN (${singleDigit} x5): ${vin}`);
    return vin;
  }

  /**
   * Generates random digit from 0-9 repeated 5 times on every run (e.g. "00000", "11111", "99999")
   */
  static randomRepeatedDigit5(): string {
    return this.repeatedClassic5();
  }

  /**
   * Generates 5x '0' ("00000")
   * Triggers Classic Fallback 2: "Update Your Vehicle Details" manual YMMT form
   */
  static classicFallbackZero5(): string {
    return this.repeatedClassic5('0');
  }

  /**
   * Generates malformed short VIN (<5 chars, Checklist #30)
   * Example: "ABC"
   */
  static malformedShort(value: string = 'ABC'): string {
    logger.info(`Generated malformed short VIN (<5 chars): ${value}`);
    return value;
  }

  /**
   * Generates a randomized 17-character invalid VIN using illegal letters (I, O, Q)
   * that will always fail NHTSA / ISO-3779 checksum decoding.
   */
  static randomIllegal17(): string {
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let result = '1QO'; // Starts with illegal chars Q and O
    for (let i = 0; i < 14; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    logger.info(`Generated random illegal 17-char VIN: ${result}`);
    return result;
  }
}
