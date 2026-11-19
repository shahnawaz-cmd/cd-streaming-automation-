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
  'TPLDV8AT213123',
  'JS23V1B253274',
  'GVLDJ2AG511582',
  '1562052330',
  '6L57B9E624828',
  'JJB1964',
  'JH23G2B179016',
  '9Y89S673608',
  'JJB2052',
  '3F03F245696',
  '9116202042',
  '8Y81A855404',
  'GVVDJ2AG510481',
  'JJB2171',
  'JJB2169',
  '4732921653',
  '4P57W3Y215905',
  '10704412046668',
  '2762547',
  'JJB2414',
  'CED141B603776',
  'VL29G3B362039',
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Dedicated Generator for Classic Mapped VINs (Pre-1981).
 * Takes verified mapped make/model patterns and dynamically randomizes
 * the 4-digit serial production sequence for long patterns, or returns
 * the exact mapped classic VIN for short patterns.
 */
export class ClassicMappedVin {
  static generate(): string {
    const base = randomItem(CLASSIC_MAPPED_VIN_POOL);
    if (base.length >= 9 && /\d{4}$/.test(base)) {
      const randomSerial = String(Math.floor(1000 + Math.random() * 9000));
      const uniqueVin = `${base.slice(0, -4)}${randomSerial}`;
      logger.pass(`Generated unique Classic Mapped VIN: ${uniqueVin} (base: ${base.slice(0, -4)})`);
      return uniqueVin;
    }
    logger.pass(`Selected exact Classic Mapped VIN: ${base}`);
    return base;
  }
}
