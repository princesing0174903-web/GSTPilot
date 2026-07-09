# Testing Strategy — GSTPilot Infinity™

**Project:** `gstpilot1` (Firebase, region `asia-south1`)
**Last updated:** Phase 11 — DevOps & Compliance
**Owner:** Platform Engineering

---

## 1. Test Pyramid

```
                ▲
                │
            ┌───┴───┐
            │  E2E  │  10% — Playwright, nightly, full user journeys
            └───┬───┘
                │
        ┌───────┴───────┐
        │  Integration  │  20% — Firebase Emulator, API + DB + Auth
        └───────┬───────┘
                │
    ┌───────────┴───────────┐
    │        Unit           │  70% — Vitest, fast, deterministic
    └───────────────────────┘
```

| Layer | Share | Tools | Speed |
| --- | --- | --- | --- |
| Unit | 70% | Vitest + jsdom | <1ms / test |
| Integration | 20% | Vitest + Firebase Emulator | ~50ms / test |
| End-to-end | 10% | Playwright + Firebase Emulator | ~2s / test |

---

## 2. Tools

| Tool | Role | Config file |
| --- | --- | --- |
| **Vitest** | Unit + integration test runner (Vite-native, fast) | `vitest.config.ts` |
| **Firebase Emulator Suite** | Local Firestore / Auth / Functions / Storage for integration + e2e | `firebase.json` + `firebase emulators:start` |
| **Playwright** | Browser-driven e2e tests | `playwright.config.ts` (TBD when first e2e is written) |
| **@vitest/coverage-v8** | Coverage reports (V8 native, fast) | `vitest.config.ts` (`coverage.provider: 'v8'`) |

> **Note:** Vitest is NOT yet installed in this project. Phase 11 creates the config (`vitest.config.ts`) + this strategy doc only. Install when ready:
> ```bash
> bun add -d vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
> ```

---

## 3. Test Structure

```
src/
  lib/
    billing-provider/
      encryption.ts
      encryption.test.ts          # unit — co-located with source
    gst-utils.ts
    gst-utils.test.ts             # unit — co-located
  hooks/
    use-firestore.ts
    use-firestore.test.ts         # unit (mocked Firestore)
  components/
    auth/
      LoginPage.tsx
      LoginPage.test.tsx          # unit (Testing Library + jsdom)

tests/
  integration/
    api/
      invoices.test.ts            # integration — hits emulator
      billing.test.ts             # integration — webhook signature verify
      auth.test.ts                # integration — signup → onUserCreate trigger
    functions/
      billing-renewals.test.ts    # integration — runs the scheduled fn
      audit-log-write.test.ts     # integration — onCall trigger
  e2e/
    auth.spec.ts                  # Playwright — full signup flow
    invoice-create.spec.ts        # Playwright — create + send invoice
    gstr-file.spec.ts             # Playwright — file GSTR-1 return
    oracle-chat.spec.ts           # Playwright — AI Oracle Q&A

vitest.config.ts                  # config (created in Phase 11)
playwright.config.ts              # config (TBD — create when first e2e is written)
```

### 3.1 Naming conventions

- **Unit tests:** `*.test.ts` or `*.test.tsx`, co-located next to the source file.
- **Integration tests:** `tests/integration/**/*.test.ts`.
- **E2E tests:** `tests/e2e/**/*.spec.ts`.

### 3.2 File-size guideline

Each test file should be ≤ 300 lines. Split larger suites by feature surface (e.g. `encryption.test.ts`, `encryption.webhook.test.ts`).

---

## 4. Coverage Targets

| Directory | Target | Why |
| --- | --- | --- |
| `src/lib/*` | **80%** lines | Pure logic (encryption, GST utils, billing provider) — easy to test, high blast radius |
| `src/app/api/*` | **60%** lines | 586 routes — prioritize billing, auth, financial routes |
| `src/components/*` | **40%** lines | UI components — focus on auth-gated + form-validation components |
| `functions/src/*` | **80%** lines | Cloud Functions — all 12 triggers must have integration tests |
| Everything else | No target | Types, configs, scripts — covered opportunistically |

Coverage is reported by Vitest's V8 provider. CI fails the build if coverage drops below target for any directory. (This enforcement will be enabled when Vitest is installed.)

---

## 5. CI Integration

| Workflow | Trigger | Runs | Gate |
| --- | --- | --- | --- |
| **Unit tests** | Every PR + push to main | `bunx vitest run --coverage` | Must pass + coverage ≥ target |
| **Typecheck** | Every PR | `bunx tsc --noEmit` | Must pass |
| **Integration tests** | On merge to main (post-CI) | `bunx vitest run --config vitest.integration.config.ts` (with emulator running) | Must pass — blocks deploy |
| **E2E tests** | Nightly cron (`0 0 * * *` IST) + before each production deploy | `bunx playwright test` (with emulator running) | Nightly: alert on failure. Pre-deploy: blocks deploy |

The `.github/workflows/ci.yml` (created in Phase 11) covers lint + typecheck + build + security-scan + functions-build. A future PR will add `vitest` jobs once Vitest is installed (to avoid breaking CI before the dependency is added).

---

## 6. Firebase Emulator Setup

### 6.1 Start the emulator

```bash
# From project root — requires firebase-tools installed globally.
firebase emulators:start --only firestore,auth,functions,storage
```

This starts:
- Firestore emulator on `localhost:8080`
- Auth emulator on `localhost:9099`
- Cloud Functions emulator on `localhost:5001`
- Storage emulator on `localhost:9199`
- Emulator UI on `localhost:4000`

### 6.2 Environment variables for tests

```bash
# Required by firebase-admin to talk to the emulator instead of production:
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
export FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
export FUNCTIONS_EMULATOR_HOST=localhost:5001
export GOOGLE_APPLICATION_CREDENTIALS=""   # unset — emulator doesn't need it
```

### 6.3 Seed the emulator for tests

```bash
# Seed reference data (plans, providers, feature flags):
bun run scripts/seed-emulator.ts
# (This script will be created in a future phase — uses firebase-admin to
#  write the same seed data as scripts/seed-invoice-cloud.mts but to the emulator.)
```

### 6.4 Reset between tests

In integration tests, call this before each test:

```ts
import { Firestore } from 'firebase-admin/firestore";

async function clearFirestore(db: Firestore): Promise<void> {
  const collections = await db.listCollections();
  for (const col of collections) {
    const docs = await col.listDocuments();
    await Promise.all(docs.map((d) => d.delete()));
  }
}

beforeEach(async () => {
  await clearFirestore(db);
});
```

---

## 7. Cloud Functions Testing

### 7.1 Setup

```bash
firebase emulators:start --only functions,firestore
```

The Functions emulator auto-reloads on file changes in `functions/src/`.

### 7.2 Calling `onCall` functions from tests

```ts
// tests/integration/functions/audit-log-write.test.ts
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";

const app = initializeApp({ projectId: "demo-gstpilot", /* ... */ });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
const functions = getFunctions(app);
// connectFunctionsEmulator(functions, "localhost", 5001);

test("auditLogWrite writes an entry with server-stamped actorUid", async () => {
  await signInWithEmailAndPassword(auth, "test@gstpilot.in", "password123");
  const auditLogWrite = httpsCallable(functions, "auditLogWrite");
  const res = await auditLogWrite({ orgId: "test-org", action: "test.action" });
  expect(res.data).toMatchObject({ success: true });
  // Verify the Firestore doc was actually written:
  const snap = await db.collection("orgs/test-org/auditLogs").get();
  expect(snap.size).toBe(1);
  expect(snap.docs[0].data().actorEmail).toBe("test@gstpilot.in");
});
```

### 7.3 Testing `onSchedule` functions

Scheduled functions don't fire automatically in the emulator. Invoke them manually via the Emulator UI (`http://localhost:4000/functions`) or via the Functions Emulator REST API:

```bash
curl -X POST http://localhost:5001/gstpilot1/asia-south1/billingRenewals
```

In tests, prefer directly importing the function handler and calling it with a mocked `EventContext` — this is faster than going through the emulator.

### 7.4 Testing `onRequest` webhooks

```ts
// tests/integration/functions/billing-webhook.test.ts
import { fetch } from "undici";
import crypto from "node:crypto";

test("billingWebhook verifies Razorpay signature", async () => {
  const body = JSON.stringify({ event: "payment.captured", /* ... */ });
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  const res = await fetch("http://localhost:5001/gstpilot1/asia-south1/billingWebhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gstp-provider": "razorpay",
      "x-razorpay-signature": signature,
    },
    body,
  });
  expect(res.status).toBe(200);
});
```

---

## 8. Sample Unit Test

```ts
// src/lib/billing-provider/encryption.test.ts
import { describe, expect, it } from "vitest";
import { encrypt, decrypt, loadKey } from "./encryption";

const KEY = loadKey("a".repeat(64)); // 32-byte hex key

describe("encryption", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "GSTPilot test plaintext 1234";
    const encrypted = encrypt(plaintext, KEY);
    expect(encrypted).not.toContain(plaintext);
    const decrypted = decrypt(encrypted, KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same plaintext";
    const a = encrypt(plaintext, KEY);
    const b = encrypt(plaintext, KEY);
    expect(a).not.toBe(b); // IV is random
  });

  it("throws on tampered ciphertext (auth tag verification)", () => {
    const encrypted = encrypt("plaintext", KEY);
    const tampered = encrypted.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered, KEY)).toThrow();
  });
});
```

---

## 9. Sample Integration Test

```ts
// tests/integration/api/invoices.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const app = initializeApp({ projectId: "demo-gstpilot", apiKey: "demo" });
const db = getFirestore(app);
// Use emulator host set via FIRESTORE_EMULATOR_HOST env var.

describe("POST /api/invoices", () => {
  beforeAll(async () => {
    // Seed a test org + user.
    await addDoc(collection(db, "orgs"), { name: "Test Org", plan: "pro" });
  });

  it("creates an invoice and persists to Firestore", async () => {
    const res = await fetch("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "test-client",
        amount: 1000,
        gstRate: 18,
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBeDefined();

    const snap = await getDocs(collection(db, "orgs/test-org/invoices"));
    expect(snap.size).toBeGreaterThan(0);
  });
});
```

---

## 10. Sample E2E Test

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("user can sign up and lands on the dashboard", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.click("text=Sign up");
  await page.fill("[name=email]", `e2e-${Date.now()}@gstpilot.in`);
  await page.fill("[name=password]", "E2Etestpass123!");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator("h1")).toContainText("Dashboard");
});
```

---

## 11. Test Data

- **Unit tests:** use mocked data only — no real Firestore, no network.
- **Integration tests:** seed via `firebase-admin` against the emulator before each test, clear after.
- **E2E tests:** sign up fresh accounts per test run — never reuse production data.

Fake data generators:

```ts
// tests/helpers/factories.ts
export const fakeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: `inv_${Math.random().toString(36).slice(2)}`,
  clientId: `cli_${Math.random().toString(36).slice(2)}`,
  amount: 1000 + Math.floor(Math.random() * 100000),
  gstRate: 18,
  status: "draft",
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const fakeUser = (overrides: Partial<User> = {}): User => ({
  uid: `uid_${Math.random().toString(36).slice(2)}`,
  email: `test-${Date.now()}@gstpilot.in`,
  displayName: "Test User",
  ...overrides,
});
```

---

## 12. Vitest Configuration (created in Phase 11)

See `/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["node_modules/**", ".next/**", "src/**/*.test.{ts,tsx}"],
      thresholds: {
        lines: 60, // global floor; per-directory targets enforced separately
      },
    },
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
```

---

## 13. Roadmap

| Phase | Task |
| --- | --- |
| ✅ Phase 11 | Created `vitest.config.ts` + this strategy doc. |
| ⏳ Phase 12 | Install Vitest + write first unit tests for `src/lib/billing-provider/encryption.ts`, `src/lib/gst-utils.ts`, `src/lib/billing-provider/verify-webhook.ts`. Add a `vitest` job to `.github/workflows/ci.yml`. |
| ⏳ Phase 12 | Set up Firebase Emulator in CI (cached binary, started before integration tests). |
| ⏳ Phase 13 | Write integration tests for the 12 Cloud Functions. |
| ⏳ Phase 14 | Install Playwright + write the 4 sample e2e specs. |
| ⏳ Phase 14 | Add nightly Playwright workflow in `.github/workflows/e2e-nightly.yml`. |
| ⏳ Phase 15 | Coverage enforcement per directory (§4) via Vitest thresholds + a custom CI check. |

---

## 14. Change Log

| Date | Change | Author |
| --- | --- | --- |
| Phase 11 | Initial testing strategy + `vitest.config.ts` created | Platform Engineering |
