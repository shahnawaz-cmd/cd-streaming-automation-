import { Logger } from '../utils/Logger';

const logger = new Logger('ClassicUnmappedVin');

const CLASSIC_UNMAPPED_VIN_POOL = [
  '245GH4156001',
  'RASLTR',
  'TPOTT',
  'GHW4KMN',
  'RAWALS',
  'VVNDMZD',
  'UPOLK',
  'NMNCX',
  'RTYEWS',
  'BUILD',
  'RFGDS',
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Dedicated Generator for Classic Unmapped VINs (5-14 digits).
 * Produces valid unmapped classic inputs with randomized suffixes to ensure uniqueness.
 */
export class ClassicUnmappedVin {
  static generate(): string {
    const base = randomItem(CLASSIC_UNMAPPED_VIN_POOL);
    const randomSuffix = String(Math.floor(10 + Math.random() * 90));
    const uniqueVin = `${base}${randomSuffix}`;
    logger.pass(`Generated unique Classic Unmapped VIN: ${uniqueVin}`);
    return uniqueVin;
  }
}
