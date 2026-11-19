import { chromium, FullConfig } from '@playwright/test';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { ENV } from './env';

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const VERIFIED_CLASSIC_MAPPED_POOL = [
  'XP29G72104639', // 1967 Plymouth Belvedere / Satellite
  '3N67K5M340214', // 1975 Oldsmobile Cutlass
  '242378Z126752', // 1968 Pontiac GTO
  '242176P1487190',// 1966 Pontiac GTO
  '233356P614878', // 1966 Pontiac Tempest
  '242177K129818', // 1967 Pontiac GTO
  '1H57H5Z447879', // 1975 Chevrolet Monte Carlo
  '3F91H525247',   // 1973 Mercury Cougar
];

/**
 * Pre-fetches a pool of both Modern and Classic Mapped VINs
 * during Global Setup so all tests resolve them in 0ms!
 */
async function prefetchVinPool(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  const cacheFile = path.resolve(process.cwd(), 'src', 'data', 'vin-cache.json');

  let modernVins: string[] = [];
  const classicMappedVins: string[] = [...VERIFIED_CLASSIC_MAPPED_POOL];

  if (mongoUri) {
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000,
    });

    try {
      await client.connect();
      const dbName = process.env.MONGO_DB_NAME || 'sales_history';
      const collName = process.env.MONGO_COLL_NAME || 'sales13';
      const coll = client.db(dbName).collection(collName);

      const modernYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
      const randomYear = modernYears[Math.floor(Math.random() * modernYears.length)];
      const randomSkip = Math.floor(Math.random() * 3000);

      const modernDocs = await coll
        .find(
          { year: randomYear, $expr: { $eq: [{ $strLenCP: '$vin' }, 17] } },
          { projection: { vin: 1 } }
        )
        .skip(randomSkip)
        .limit(30)
        .toArray();

      modernVins = modernDocs.map((d) => String(d.vin).trim()).filter((v) => v.length === 17);
    } catch (_) {
    } finally {
      await client.close().catch(() => {});
    }
  }

  if (modernVins.length > 0 || classicMappedVins.length > 0) {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify(
        {
          modernVins,
          classicMappedVins,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const cachePath = path.resolve(process.cwd(), 'flow-detection.json');
  const vinPrefetchPromise = prefetchVinPool();

  let activeFlow = 'streaming';

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const age = Date.now() - new Date(cached.detectedAt).getTime();
      if (age < CACHE_TTL_MS && cached.activeFlow) {
        process.env.ACTIVE_FLOW = cached.activeFlow;
        await vinPrefetchPromise;
        return;
      }
    } catch (_) {}
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(ENV.baseURL, { waitUntil: 'domcontentloaded' });
    const handle = await page.waitForFunction(
      () => {
        const match = document.cookie.match(/(?:^|;\s*)checkout_flow=([^;]+)/);
        if (match?.[1]) return decodeURIComponent(match[1]);
        try {
          const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
          return settings.checkout_flow || null;
        } catch {
          return null;
        }
      },
      undefined,
      { timeout: 8_000 }
    );
    activeFlow = (await handle.jsonValue()) as string;
  } catch {
    // fallback
  } finally {
    await browser.close().catch(() => {});
  }

  process.env.ACTIVE_FLOW = activeFlow;
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ activeFlow, detectedAt: new Date().toISOString() }, null, 2)
  );

  await vinPrefetchPromise;
}
