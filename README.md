# CD Streaming Automation Suite

Enterprise-grade Playwright (TypeScript) end-to-end test automation framework built for real-time Server-Sent Events (SSE) streaming automotive decoding and checkout flows on [ClassicDecoder](https://dev.pintonaturals.com).

Strictly engineered according to the **8-Layer Enterprise Architecture** with Page Object Model (POM), custom fixtures, dynamic branching handlers, lightweight evidence capture, and 100% offline self-healing locators.

---

## 🏛️ Architecture Overview (8-Layer Design)

```
CD Streaming Framework
├── Layer 1: Config            (src/config/)     - Environment configs, timeouts, and parallel global setup
├── Layer 2: Modular POM       (src/pages/)      - Sub-component based Page Objects per page (`preview/`, `home/`, `pricing/`: plans, coupon banner, FAQ, email dialog)
├── Layer 3: Workflows         (src/modules/)    - Business actions, race condition handlers & exit intent
├── Layer 4: Test Data         (src/data/)       - MongoDB live VIN pool, Classic VIN generator, Anti-bounce emails, Stripe test card & regional (geo) pool
├── Layer 5: Utilities         (src/utils/)      - Self-healing locator agent, isolated browser sessions, plans-API client, price parser & structured logging
├── Layer 6: Fixtures          (src/fixtures/)   - Dependency injection & bot fingerprint stripping
├── Layer 7: Test Specs        (tests/)          - `cd-streaming.spec.ts` (TC-01..TC-19) + independent `pricing.spec.ts` (TC-PRICING-01..06)
└── Layer 8: Evidence          (src/modules/)    - Focused element snapshots (~25 KB) & JSON telemetry (1 KB)
```

---

## 🚀 Key Features

1. **Zero-Wait Dynamic Branching Handlers**:
   - **Modern 17-Char VINs (`TC-01`)**: Instant `Promise.race` evaluates Condition A (Decoded & CTA Enabled) vs Condition B (`"We couldn't find a vehicle for this VIN"` & CTA Disabled) without 60s timeout delays.
   - **Classic Pre-1981 VINs (`TC-02`)**: Instant `Promise.race` evaluates Condition A (Decoded & CTA Enabled) vs Condition B (`"Update Your Vehicle Details"` manual YMMT selection form & `"Get Records"` CTA).
2. **Exit-Intent & Coupon Guard (`TC-03`)**:
   - Triggers exit-intent dialog via viewport boundary dispatch (`clientY: -1`).
   - Automatically injects anti-bounce enterprise emails (`shahnawazXX@empirepixel.com`) to claim 15% discount.
   - Verifies the Coupon Guard blocks/disables checkout during discount application, then verifies discounted pricing ($25.49) on CTA and plans.
3. **Bot Tag Stripping & Chromium Unthrottling**:
   - Masks `navigator.webdriver = undefined`.
   - Disables background timer and renderer throttling flags matching organic user browser performance.
4. **Lightweight Evidence Capture**:
   - Avoids full-page screenshots that pause SSE network streams during decoding.
   - Captures targeted element snippets (~25 KB PNG) and structured JSON telemetry (~1 KB).
5. **Self-Healing Locators (100% Free & Offline)**:
   - Automated multi-strategy locator cascades (`getByRole` ➔ `getByTestId` ➔ `getByPlaceholder` ➔ CSS/XPath) with autonomous failure recovery and telemetry logging.

6. **Pricing Purchase with Payment API Capture (`TC-PRICING-01`)**:
   - Independent spec (`tests/pricing.spec.ts`): `/pricing` ➔ email dialog ➔ Checkout ➔ Stripe test card ➔ members area credits.
   - Captures and asserts the Stripe `payment_intents/{id}/confirm` response (`succeeded`, test mode, amount & currency) and the site's `/api/update-payment` response (`success`, Report Credits = 1); account token and client secret are redacted from the attached JSON.
   - Amount and currency are compared dynamically (minor units, zero-decimal aware), so it works for any location-based currency. Runs against dev (Stripe test mode) only.
7. **Pricing Coupon, Dynamic Discount (`TC-PRICING-02`)**: the discount percentage is never hard-coded; it is read from the banner and the `validate-coupon` API (which must agree) and every plan price in both toggle modes is checked against its own no-coupon baseline.
8. **Pricing Content & Localization (`TC-PRICING-03..06`)**: plan cards are compared with the backend `/api/plans` for Personal and Business in both Report and Build Sheet modes; the FAQ accordion and sample-report link are exercised; and injected geo cookies prove regional currency pricing (amounts compared numerically, so any currency symbol works).
9. **Microsoft Clarity Verification (`TC-18`)**: Runs on Dev in an isolated session and verifies the project tag, `window.clarity`, `_clck`/`_clsk` cookies and `/collect` beacons on Home ➔ Preview ➔ Checkout.

---

## 📋 Test Coverage Matrix

| Test ID | Test Scenario | Dynamic Handling | Data Generator |
|---------|---------------|------------------|----------------|
| **TC-01** | Modern 17-Char VIN Decoding & CTA Guard | **Condition A (Decoded)** vs **Condition B (Not Found Banner)** | Live MongoDB Pool (`VinGenerator`) |
| **TC-02** | Classic Mapped VIN Decoding & CTA Guard | **Condition A (Decoded)** vs **Condition B (Manual YMMT Form)** | Randomized 4-digit sequence (`ClassicMappedVin`) |
| **TC-03** | Exit-Intent & Coupon Guard | Popup Trigger ➔ Coupon Guard ➔ 15% Discount on Plans | Unique anti-bounce email (`EmailGenerator`) |
| **TC-04** | Invalid Modern VIN (repeated letter A-Z x17) | Fallback banner vs Decoded | `InvalidVinGenerator` |
| **TC-05** | Invalid Classic VIN (repeated digit x5) | Fallback vs Decoded; classic failover skip guard on decode timeout | `InvalidVinGenerator` |
| **TC-06** | Edit YMM | Dynamic Year/Make/Model selection + Trim verification | Live decoded VIN |
| **TC-07** | Edit Specifications | Dynamic specs update with before/after JSON telemetry | `SpecsGenerator` |
| **TC-08** | Multi-Language Localization | Random language ➔ Modern VIN decode ➔ Preview & Checkout validation | `LocaleDictionary` |
| **TC-09** | Short Invalid VIN (< 5 chars via direct URL) | Error banner & disabled checkout guard | `ShortVinGenerator` |
| **TC-10** | Add to Garage (Signup & Login) | Auto-navigation to CDMA My Garage with persisted vehicles | `GarageCredentialsGenerator` |
| **TC-11** | Upsell GIF & Site Settings Alignment | Modern vs Classic across VHR & Sticker | Live `site_settings` |
| **TC-12** | Plan Selection, Upsell Toggle & Checkout Price Sync | Currency-agnostic Preview ➔ Checkout Order Summary sync | Live MongoDB Pool |
| **TC-13** | Revisit Banner | Modern type sync & Classic updated YMMT in a new session | Live decoded VIN |
| **TC-14** | Plans "Save %" Tag Logic | Dynamic prices, currency & compounded Save % (without vs. with coupon) | Live MongoDB Pool |
| **TC-15** | Preview Email Cache | Same-session prefill, new-session validation & logged-in autofill with direct Checkout | `EmailGenerator`, `GarageCredentialsGenerator` |
| **TC-16** | Referrer & UTM Cookies | `utm_details` (UTM landing) vs `referrer` (base URL from Google) in isolated sessions | Live MongoDB Pool |
| **TC-17** | Dual Coupon | Home `offer=get20` ➔ Preview exit-intent banner still triggers | Live MongoDB Pool |
| **TC-18** | Microsoft Clarity (Dev) | Project tag, `_clck`/`_clsk` cookies, `/collect` beacons & same user across Home ➔ Preview ➔ Checkout | Live MongoDB Pool |
| **TC-19** | Regional Currency on Preview | Inject `cwa_ip`/`cwa_country` (random region of the 9-region pool, `PRICING_REGION` to pin) ➔ decode VIN ➔ Preview CTA and every plan show the region's currency sign and `/api/plans` amounts; JSON proof attached | `RegionalPool` |
| **TC-PRICING-01** | Pricing Page E2E (`tests/pricing.spec.ts`) | `/pricing` ➔ Checkout ➔ Stripe test-card payment ➔ Stripe confirm & `update-payment` API responses ➔ Report Credits; amount & currency location-agnostic | `EmailGenerator`, Stripe test card |
| **TC-PRICING-02** | Pricing Coupon (`tests/pricing.spec.ts`) | `?offer=get20` banner % == coupon API % == every plan price (baseline x (1 - %)) in Report & Build Sheet toggle modes; % is read from the site, never hard-coded | Live site |
| **TC-PRICING-03** | Pricing Plans API Parity (`tests/pricing.spec.ts`) | Every Personal plan card (Report & Build Sheet) equals `/api/plans`: quantity, total and unit price | Live site |
| **TC-PRICING-04** | Pricing Personal / Business Tabs | Personal ➔ Business ➔ Personal: each tab matches its own `/api/plans`, Business differs, Personal restored | Live site |
| **TC-PRICING-05** | Pricing FAQ & Sample Report | All FAQ items expand (non-empty answer) and collapse; sample report link opens `/sample-reports` in a new tab | Live site |
| **TC-PRICING-06** | Regional Currency | `cwa_ip`/`cwa_country` cookies for a random region (9-region pool, `PRICING_REGION=DE` to pin): API currency, `usd_price x rate` and the amount on the card all agree | `RegionalPool` |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 18
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/shahnawaz-cmd/cd-streaming-automation-.git
cd cd-streaming-automation-

# Install dependencies
npm install

# Install Playwright browser binaries
npx playwright install chromium
```

### Environment Setup
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Optional: `CLARITY_PROJECT_ID` overrides the Dev Microsoft Clarity project id used by TC-18.

---

## 🧪 Running Tests

```bash
# Run all tests in parallel (Default)
npx playwright test

# Run all tests in CI mode (Single worker, strict assertions, retries)
$env:CI="true"; npx playwright test

# Run a specific test case
npx playwright test -g "TC-01"
npx playwright test -g "TC-02"
npx playwright test -g "TC-03"
npx playwright test -g "TC-1[5-7]"   # email cache, referrer/UTM cookies, dual coupon
npx playwright test tests/pricing.spec.ts   # independent Pricing suite (purchase, coupon, API parity, tabs, FAQ, regional currency)
npx playwright test -g "TC-PRICING-06"     # regional currency (random region)
$env:PRICING_REGION="DE"; npx playwright test -g "TC-PRICING-06"   # pin a region: KR DE CR CL SA NZ PA ZA TW

# View HTML Test Report
npx playwright show-report
```

---

## 📊 Sample Execution Log

```text
Running 3 tests using 3 workers

  +0.9s [PASS]  [ClassicMappedVin] Generated unique Classic Mapped VIN: 1H57H5Z444921
  +0.9s [PASS]  [VinGenerator] Fetched new fresh Modern VIN: 57XAAPHD8P8156548
  +1.2s [PASS]  [VinGenerator] Fetched new fresh Modern VIN: L1VYCKLC7PFT00146
  +5.5s [PASS]  [VinDecodeModule] Successfully redirected to preview for VIN: 57XAAPHD8P8156548
  +5.6s [PASS]  [VinDecodeModule] Successfully redirected to preview for VIN: 1H57H5Z444921
  +6.8s [PASS]  [VinDecodeModule] Successfully redirected to preview for VIN: L1VYCKLC7PFT00146
 +27.1s [PASS]  [ClassicDecodeHandler] ✅ Condition A Succeeded: Classic VIN decoded. CTA enabled.
 +28.0s [STEP]  [ExitIntentModule] Trigger exit-intent pop-up on Preview page
 +29.0s [PASS]  [ExitIntentModule] ✅ Exit-intent popup appeared: "Wait! Before you go, grab your 15% OFF discount!"
 +29.5s [INFO]  [EvidenceModule] 📸 Attached element screenshot: TC-02-Header-Specs.png
 +29.8s [PASS]  [EmailGenerator] Generated unique test email: shahnawaz62@empirepixel.com
 +29.8s [STEP]  [ExitIntentModule] Submit exit-intent email (shahnawaz62@empirepixel.com) and verify coupon guard
 +30.9s [PASS]  [ExitIntentModule] ✅ CTA verified with $25.49 discounted price.
 +33.0s [INFO]  [EvidenceModule] 📸 Attached element screenshot: TC-03-Plans-Discount.png
 +35.4s [PASS]  [ModernDecodeHandler] ✅ Condition A Succeeded: Modern VIN decoded. CTA enabled.
  ✓  1 [chromium] › TC-02: Classic Mapped VIN - Dynamic handling (36.5s)
  ✓  2 [chromium] › TC-01: Modern 17-char VIN - Dynamic handling (37.4s)
  ✓  3 [chromium] › TC-03: Exit-Intent & Coupon Guard (37.3s)

  3 passed (46.1s, 0 retries)
```
