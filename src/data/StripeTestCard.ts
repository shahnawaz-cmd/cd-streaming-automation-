/** Stripe's public always-succeeds test card. Only ever used against the dev (test-mode) environment. */
export const STRIPE_TEST_CARD = {
  number: '4242424242424242',
  expiry: '12/30',
  cvc: '123',
} as const;
