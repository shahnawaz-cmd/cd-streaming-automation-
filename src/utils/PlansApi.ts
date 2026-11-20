import { APIRequestContext, expect } from '@playwright/test';

export type PlansKind = 'vhr' | 'sticker';
export type PlansUserType = 'user' | 'dealer';

export interface PlanApiItem {
  name: string;
  /** Quantity of credits in the plan. */
  nos: number;
  /** Plan total in the visitor's currency. */
  price: number;
  usdPrice: number;
  currencyCode: string;
  currencySign: string;
  /** Present for non-USD currencies (price = usdPrice x conversionRate). */
  conversionRate?: number;
}

/** Maps a raw `/api/plans` credit plan to a typed item. */
export function toPlanApiItem(raw: Record<string, unknown>): PlanApiItem {
  return {
    name: String(raw.name),
    nos: Number(raw.nos),
    price: Number(raw.price),
    usdPrice: Number(raw.usd_price),
    currencyCode: String(raw.currency_code),
    currencySign: String(raw.currency_sign),
    conversionRate: raw.conversion_rate === undefined ? undefined : Number(raw.conversion_rate),
  };
}

/**
 * Fetches the credit plans the pricing page is built from.
 * `cookie` lets a call carry the geo cookies (`cwa_ip` / `cwa_country`) of a simulated region.
 */
export async function fetchCreditPlans(
  request: APIRequestContext,
  kind: PlansKind,
  userType: PlansUserType,
  cookie?: string
): Promise<PlanApiItem[]> {
  const response = await request.get(`/api/plans?kind=${kind}&user_type=${userType}`, {
    headers: cookie ? { cookie } : undefined,
  });
  expect(response.status(), `/api/plans ${kind}/${userType} HTTP status`).toBe(200);
  const body = await response.json();
  expect(body.credit_plans, `/api/plans ${kind}/${userType} has credit plans`).toBeInstanceOf(Array);
  expect(body.credit_plans.length).toBeGreaterThan(0);
  return body.credit_plans.map(toPlanApiItem);
}
