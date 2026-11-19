import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { ClassicMappedVin } from './ClassicMappedVin';
import { ClassicUnmappedVin } from './ClassicUnmappedVin';
import { InvalidVinGenerator } from './InvalidVinGenerator';

const logger = new Logger('VinGenerator');

const MODERN_US_VIN_POOL = [
  '1FMCU9JD1HUC26315',
  '1FMCU9JD1HUC26314',
  '1HGCM82633A004352',
  '5YJ3E1EA1JF000001',
  '1C4RJFAG5FC123456',
  '2HGFC2F59HH512345',
  '1N4AL3AP8JC123456',
  '5NPE24AF7FH123456',
  '3FA6P0LU9KR263133',
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const cacheFilePath = path.resolve(process.cwd(), 'src', 'data', 'vin-cache.json');

/**
 * VinGenerator (Unified Entry Point)
 * 1. 17-char Modern VIN: Consumes live pre-cached MongoDB pool.
 * 2. Classic Mapped VIN: Delegated to dedicated ClassicMappedVin sub-file.
 * 3. Classic Unmapped VIN: Delegated to dedicated ClassicUnmappedVin sub-file.
 */
export class VinGenerator {
  static modern(): string {
    return randomItem(MODERN_US_VIN_POOL);
  }

  /**
   * Fetches fresh 17-char Modern VIN from pre-cached MongoDB pool,
   * randomly selecting a new VIN on every test run.
   */
  static async modernFromMongo(): Promise<string> {
    // 1. Consume random fresh VIN from pre-cached MongoDB pool
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        if (Array.isArray(cache.modernVins) && cache.modernVins.length > 0) {
          const randomIndex = Math.floor(Math.random() * cache.modernVins.length);
          const [vin] = cache.modernVins.splice(randomIndex, 1);
          fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
          if (vin && vin.length === 17) {
            logger.pass(`Fetched new fresh Modern VIN: ${vin}`);
            return vin;
          }
        }
      } catch (_) {}
    }

    // 2. Fallback: Query live MongoDB directly for a fresh random VIN
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      try {
        const { MongoClient } = await import('mongodb');
        const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
        await client.connect();
        const dbName = process.env.MONGO_DB_NAME || 'sales_history';
        const collName = process.env.MONGO_COLL_NAME || 'sales13';
        const coll = client.db(dbName).collection(collName);
        const modernYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
        const randomYear = modernYears[Math.floor(Math.random() * modernYears.length)];
        const randomSkip = Math.floor(Math.random() * 3000);
        const docs = await coll
          .find({ year: randomYear, $expr: { $eq: [{ $strLenCP: '$vin' }, 17] } }, { projection: { vin: 1 } })
          .skip(randomSkip)
          .limit(10)
          .toArray();
        await client.close();
        if (docs.length > 0) {
          const freshVin = String(docs[0].vin).trim();
          if (freshVin.length === 17) {
            logger.pass(`Fetched live fresh Modern VIN from MongoDB: ${freshVin}`);
            return freshVin;
          }
        }
      } catch (_) {}
    }

    const fallback = VinGenerator.modern();
    logger.warn(`Using fallback Modern VIN: ${fallback}`);
    return fallback;
  }

  /**
   * Generates 100% unique Classic Mapped VIN via dedicated sub-file
   */
  static classicMapped(): string {
    return ClassicMappedVin.generate();
  }

  /**
   * Generates 100% unique Classic Unmapped VIN via dedicated sub-file
   */
  static classicUnmapped(): string {
    return ClassicUnmappedVin.generate();
  }

  // Delegated Invalid & Fallback Generators
  static invalidModern17Random(): string {
    return InvalidVinGenerator.randomRepeatedLetter17();
  }

  static invalidRandomLetters17(): string {
    return InvalidVinGenerator.randomLetters17();
  }

  static invalidModern17A(): string {
    return InvalidVinGenerator.modern17A();
  }

  static invalidModern17B(): string {
    return InvalidVinGenerator.modern17B();
  }

  static invalidRepeatedModern(char?: string): string {
    return InvalidVinGenerator.repeatedModern17(char);
  }

  static invalidClassic00000(): string {
    return InvalidVinGenerator.classicFallbackZero5();
  }

  static invalidClassic5Random(): string {
    return InvalidVinGenerator.randomRepeatedDigit5();
  }

  static invalidRepeatedClassic(digit?: string): string {
    return InvalidVinGenerator.repeatedClassic5(digit);
  }

  static invalidShort(val = 'ABC'): string {
    return InvalidVinGenerator.malformedShort(val);
  }
}

export { ClassicMappedVin, ClassicUnmappedVin, InvalidVinGenerator };
