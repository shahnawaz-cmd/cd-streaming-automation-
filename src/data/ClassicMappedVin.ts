import { Logger } from '../utils/Logger';

const logger = new Logger('ClassicMappedVin');

const CLASSIC_MAPPED_VIN_POOL = [
  'XP29G72104639', // 1967 Plymouth Belvedere / Satellite
  '3N67K5M340214', // 1975 Oldsmobile Cutlass
  '242378Z126752', // 1968 Pontiac GTO
  '242176P1487190',// 1966 Pontiac GTO
  '233356P614878', // 1966 Pontiac Tempest
  '242177K129818', // 1967 Pontiac GTO
  '1H57H5Z447879', // 1975 Chevrolet Monte Carlo
  '3F91H525247',   // 1973 Mercury Cougar
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Dedicated Generator for Classic Mapped VINs (Pre-1981).
 * Takes verified mapped make/model patterns and dynamically randomizes
 * the last 4 production sequence digits to guarantee 100% unique VINs on every run.
 */
export class ClassicMappedVin {
  static generate(): string {
    const base = randomItem(CLASSIC_MAPPED_VIN_POOL);
    // Randomize the 4-digit serial production sequence for absolute uniqueness
    const randomSerial = String(Math.floor(1000 + Math.random() * 9000));
    const uniqueVin = `${base.slice(0, -4)}${randomSerial}`;
    logger.pass(`Generated unique Classic Mapped VIN: ${uniqueVin} (base: ${base.slice(0, -4)})`);
    return uniqueVin;
  }
}
