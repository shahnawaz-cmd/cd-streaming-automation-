# CD Streaming Automation Suite

Enterprise-grade Playwright (TypeScript) end-to-end test automation framework built for real-time Server-Sent Events (SSE) streaming automotive decoding and checkout flows on [ClassicDecoder](https://dev.pintonaturals.com).

Strictly engineered according to the **8-Layer Enterprise Architecture** with Page Object Model (POM), custom fixtures, dynamic branching handlers, lightweight evidence capture, and 100% offline self-healing locators.

---

## 🏛️ Architecture Overview (8-Layer Design)

```
CD Streaming Framework
├── Layer 1: Config            (src/config/)     - Environment configs, timeouts, and parallel global setup
├── Layer 2: Modular POM       (src/pages/)      - Sub-component based Page Objects (Header, Modal, Fallbacks)
├── Layer 3: Workflows         (src/modules/)    - Business actions, race condition handlers & exit intent
├── Layer 4: Test Data         (src/data/)       - MongoDB live VIN pool, Classic VIN generator & Anti-bounce emails
├── Layer 5: Utilities         (src/utils/)      - Self-healing locator agent & structured logging
├── Layer 6: Fixtures          (src/fixtures/)   - Dependency injection & bot fingerprint stripping
├── Layer 7: Test Specs        (tests/)          - Concise 3-step declarative specifications
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

---

## 📋 Test Coverage Matrix

| Test ID | Test Scenario | Dynamic Handling | Data Generator |
|---------|---------------|------------------|----------------|
| **TC-01** | Modern 17-Char VIN Decoding & CTA Guard | **Condition A (Decoded)** vs **Condition B (Not Found Banner)** | Live MongoDB Pool (`VinGenerator`) |
| **TC-02** | Classic Mapped VIN Decoding & CTA Guard | **Condition A (Decoded)** vs **Condition B (Manual YMMT Form)** | Randomized 4-digit sequence (`ClassicMappedVin`) |
| **TC-03** | Exit-Intent & Coupon Guard | Popup Trigger ➔ Coupon Guard ➔ 15% Discount on Plans | Unique anti-bounce email (`EmailGenerator`) |

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
