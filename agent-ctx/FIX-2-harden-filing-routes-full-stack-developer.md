# Task FIX-2 — Harden File/EInvoice/EWayBill Routes

**Agent**: full-stack-developer (Z.ai Code)
**Task**: Add rate limiting + zod input validation + GST audit logging to 4 CRITICAL legally-significant routes.

## Status: COMPLETE

## Files Modified

| File | Before | After | Delta |
|------|--------|-------|-------|
| `src/lib/gst-reconciliation/server/audit.ts` | 102 | 108 | +6 |
| `src/app/api/gstr1/file/route.ts` | 47 | 118 | +71 |
| `src/app/api/gstr3b/file/route.ts` | 47 | 118 | +71 |
| `src/app/api/einvoice/route.ts` | 96 | 228 | +132 |
| `src/app/api/ewaybill/route.ts` | 105 | 282 | +177 |
| **Total** | **397** | **854** | **+457** |

## New Audit Action Types (7)
- `gst.gstr1.file`
- `gst.gstr3b.file`
- `gst.einvoice.generate`
- `gst.einvoice.cancel`
- `gst.ewaybill.generate`
- `gst.ewaybill.extend`
- `gst.ewaybill.cancel`

## New Audit Entity Types (3)
- `EInvoice`
- `EWayBill`
- `GSTReturn` (added in addition to spec — see deviations)

## Lint Result
```
$ bunx eslint <5 files>
EXIT_CODE=0
```
All 5 files pass lint with zero errors.

## Constraints Honored
- ✅ `dynamic = 'force-dynamic'` + `runtime = 'nodejs'` preserved
- ✅ `requireAuth` + `requireOrgMembership` checks preserved
- ✅ Response shapes preserved (frontend won't break)
- ✅ Business logic untouched (all 9 gstn lib function calls preserved verbatim)
- ✅ Audit logging non-blocking (logGSTAudit internally wrapped + outer try/catch on failure path)
- ✅ audit.ts: ONLY unions changed; sanitizeDetails + REDACTED_KEYS + logGSTAudit body untouched

## Rate Limit Rules
- POST handlers (filing/mutation): `{ windowMs: 60_000, max: 5 }` per user
- GET handlers (status lookup): `{ windowMs: 60_000, max: 30 }` per user
- Scopes: `gst-filing`, `einvoice-mutation`, `ewaybill-mutation`, `einvoice-status`, `ewaybill-status`

## Zod Schemas
- **gstr1/file, gstr3b/file**: `z.object({ organizationId, gstin (GSTIN regex), period (YYYY-MM regex, optional) })`
- **einvoice POST**: `z.discriminatedUnion('action', [generateSchema, cancelSchema])`
  - generate: sellerGstin + buyerGstin (GSTIN regex), invoiceNo + invoiceDate + hsnCode (non-empty), invoiceValue/taxableValue/igst/cgst/sgst (non-negative numbers)
  - cancel: irn + reason (non-empty)
- **ewaybill POST**: `z.discriminatedUnion('action', [generateSchema, extendSchema, cancelSchema])`
  - generate: supplierGstin + recipientGstin (GSTIN regex), documentNo + documentDate + subSupplyType + fromState + toState (non-empty), transactionType + supplyType (enums), totalValue/cgst/sgst/igst/cess/distanceKm (non-negative), transporterId + vehicleNo (optional)
  - extend: ewbNo + reason (non-empty), extraDays (positive integer)
  - cancel: ewbNo + reason (non-empty)

## Deviations from Spec (with justification)
1. **Added `'GSTReturn'` to entity union** — Filing routes operate on the `GSTReturn` Prisma model. Using it as the audit entity is more semantically accurate than overloading `GSPProviderConfig`. Spec allowed expansion of the union.
2. **Default-to-generate preprocessing** — `z.discriminatedUnion` requires the discriminator (`action`) to be present. The original code's contract was "missing `action` ⇒ generate". To preserve this contract, the raw JSON is preprocessed: if `action` is missing, it is set to `'generate'` before `schema.parse`. This preserves API compatibility for existing frontend callers that omit `action`.
3. **GET rate limiting** was spec-required ("For GET handlers... use a looser limit: 30/min") — not a deviation.
4. **Zod NOT added to GET handlers** — Spec only requested zod body validation for POST handlers. GET continues using `searchParams.get(...)` + manual checks (preserves existing query-string API).
5. **Failure-path audit uses `uid` from outer scope** — Declared in the function's outer scope (initialized to `'unknown'`) so the catch block can construct a meaningful audit entry with the user id. Success path uses the real uid.
6. **`entityId` for filing routes uses `result.ackNo ?? '${gstin}-${period}'`** — The current `fileGstr1`/`fileGstr3b` stubs return `ackNo: null`. When real GSTN integration ships, audit will use the real ARN. Synthetic key is non-sensitive (GSTIN is public; period is public).

## What Did NOT Change
- Business logic in `@/lib/gstn/{einvoice,ewaybill,gstr1,gstr3b}.ts` — untouched
- `@/lib/rate-limit.ts` — untouched (already had everything needed)
- `@/lib/auth/session.ts` — untouched
- `@/lib/gst-reconciliation/server/audit.ts` — sanitizeDetails, REDACTED_KEYS, logGSTAudit body all untouched (only unions extended)
- Frontend callers — no changes needed (response shapes preserved)
