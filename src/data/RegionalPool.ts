export interface RegionalConfig {
  /** ISO country injected through the `cwa_country` cookie. */
  country: string;
  /** Public IP of that country injected through the `cwa_ip` cookie (drives the geo/currency lookup). */
  ip: string;
  name: string;
  /** Currency the backend must price this region in. */
  currency: string;
}

/** Non-USD / non-CAD regions the Dev backend localizes pricing for. */
export const REGIONAL_POOL: RegionalConfig[] = [
  { country: 'KR', ip: '79.110.55.34', name: 'South Korea', currency: 'KRW' },
  { country: 'DE', ip: '85.214.132.117', name: 'Germany', currency: 'EUR' },
  { country: 'CR', ip: '138.59.135.94', name: 'Costa Rica', currency: 'CRC' },
  { country: 'CL', ip: '45.250.252.51', name: 'Chile', currency: 'CLP' },
  { country: 'SA', ip: '146.70.167.70', name: 'Saudi Arabia', currency: 'SAR' },
  { country: 'NZ', ip: '180.149.231.71', name: 'New Zealand', currency: 'NZD' },
  { country: 'PA', ip: '190.97.167.149', name: 'Panama', currency: 'PAB' },
  { country: 'ZA', ip: '129.232.237.178', name: 'South Africa', currency: 'ZAR' },
  { country: 'TW', ip: '185.189.161.137', name: 'Taiwan', currency: 'TWD' },
];

/** Random region, or the one named by `PRICING_REGION` (e.g. `PRICING_REGION=DE`) to reproduce a run. */
export function pickRegion(override = process.env.PRICING_REGION): RegionalConfig {
  if (override) {
    const match = REGIONAL_POOL.find((r) => r.country === override.toUpperCase());
    if (!match) throw new Error(`[RegionalPool] Unknown PRICING_REGION "${override}"`);
    return match;
  }
  return REGIONAL_POOL[Math.floor(Math.random() * REGIONAL_POOL.length)];
}
