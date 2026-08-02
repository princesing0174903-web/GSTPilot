# GSTPilot — The Operating Constitution
*Permanent. Every future line of code must pass these gates.*

---

## THE EIGHT GATES

Before writing any code, the work must satisfy ALL eight gates, in order:

1. **Identify the workflow.** No workflow, no code.
2. **Remove duplicate pages.** A domain concept has exactly one implementation.
3. **Remove fake implementations.** No fabricated data. No mock masquerading as real.
4. **Connect real database.** Prisma is the source of truth, not in-memory arrays.
5. **Connect real integrations.** Or honestly label as "Demo" / "Coming after Stage N."
6. **Make Oracle proactive, not reactive.** Oracle prepares actions; it never waits to be asked.
7. **The workflow must be executable from start to finish.** No dead ends. No "TODO" steps.
8. **Every feature must save the user at least 10 minutes.** If it doesn't, it doesn't exist.

If a piece of work cannot trace to a workflow step, it does not get done.
If a workflow step cannot pass all 8 gates, the workflow is not done.

---

## THE THREE PERMANENT RULES

### Rule A — Build Jobs, Not Pages

| ❌ Page-first thinking | ✅ Job-first thinking |
|---|---|
| Invoice Page | Invoice Workflow |
| Banking Page | Bank Reconciliation Engine |
| Oracle Page | Oracle Decision Engine |
| Returns Page | GST Filing Pipeline |
| Notices Page | Notice Response Workflow |

A "page" is a dead surface. A "job" is work that gets done. Every UI surface must be the visible face of a job — never a standalone screen.

**Practical implication:** Before creating any new component, ask "what job does this complete?" If the answer is "displays information," don't build it. Information display is a side-effect of a job, not a job itself.

### Rule B — Oracle Is an Employee, Not a Chatbot

Oracle's job is **not** to answer questions.
Oracle's job is to **prepare actions**.

```
Oracle continuously observes
  → invoices, payments, GST, banking, compliance, deadlines

Oracle detects
  → what needs to happen, what's wrong, what's overdue

Oracle prepares
  → the exact action, the exact payload, the exact explanation

Human approves
  → one click

Oracle executes
  → the full chain, atomically, audited
```

**Oracle never says "How can I help you today?"**
**Oracle always says "Here's what I already did. Here's what needs you."**

The day Oracle waits for the user to type a question is the day we failed.

### Rule C — End at "User Never Needs to Think"

A workflow is not done when the user clicks Approve.
A workflow is done when the user opens GSTPilot and the work is **already prepared**.

The ideal morning screen:

```
Oracle

Good morning.

Yesterday:
  ✓ 14 invoices matched automatically
  ✓ ₹3,42,000 reconciled
  ⚠ One GST mismatch detected.

I already prepared the correction.

[ Approve ]
```

That is not AI. That is an employee. Every workflow ends there.

---

## THE PRODUCT VISION

> **GSTPilot is no longer a collection of finance modules.**
>
> **GSTPilot is an AI Finance Operating System.**
>
> Every screen, every API, every component, and every workflow must answer one question:
>
> **"What should Oracle do automatically before the user even asks?"**
>
> Oracle must continuously observe invoices, payments, GST, banking, compliance, and deadlines.
>
> Oracle's job is not to answer questions.
>
> Oracle's job is to prepare actions.
>
> Humans approve.
>
> Oracle executes.
>
> Every future feature must strengthen this vision.

---

## THE TRAJECTORY

```
InvoiceOS      →  Stage 1: one workflow perfect (Invoice → Bank → GST → Oracle)
                  The first workflow investors see. The demo that sells.

     ↓

FinanceOS      →  Stages 2–4: 5 workflows compound
                  Invoice → Bank → GST → ITC → Notices → Month-end close
                  Oracle becomes the command surface, not a page.

     ↓

BusinessOS     →  Stages 5–7: 100 → 1,000 customers
                  Accounting, Payroll, ROC, Multi-firm, Marketplace
                  Oracle runs the business; humans approve the exceptions.
```

This is the Stripe → Rippling → Ramp trajectory. Start with one core workflow. Perfect it. Expand into adjacent workflows. The discipline is: **one complete workflow at a time, never two in parallel.**

---

## THE ARCHITECTURE STANDARD (Build Like Stripe)

```
[1] SCHEMA      → Prisma model + migration + indexes
        ↓ (gate: schema reviewed, indexed, orgId present)
[2] SERVICE     → Pure functions in src/lib/<workflow>/
                  No Next.js, no req/res. Pure, testable.
        ↓ (gate: unit tests pass, edge cases covered)
[3] API ROUTE   → src/app/api/<workflow>/route.ts
                  Thin: parse → call service → log audit → respond.
                  Never contains business logic.
        ↓ (gate: curl returns 200 with real data)
[4] ORACLE      → If the workflow should be AI-actable, define Oracle tools
                  in src/lib/<workflow>/oracle-tools.ts
                  Tools suggest actions; never execute without approval.
        ↓ (gate: tool produces a real, reviewable action)
[5] TESTING     → One e2e test per workflow step.
                  "Given real data, when X, then Y."
        ↓ (gate: test green on real DB, not mock)
[6] FRONTEND    → Hook (TanStack Query) → Component → existing page section.
                  The UI is the LAST thing built, never the first.
                  No new pages unless the workflow cannot live on an existing surface.
        ↓ (gate: browser-verified, loading/error/empty, responsive, ≤3s load)
DONE
```

---

## THE DISABLE DISCIPLINE

Fake features are **not redesigned**. They are **disabled cleanly**:

- **Feature flag off** (component stays as dead code, mined later if needed)
- **Nav item hidden** (the user never sees it)
- **Honest empty state** if the feature is core to the promise but not built

A new user must immediately understand what GSTPilot does. ~8 nav items, not 60.

---

## THE COMMIT DISCIPLINE

- Each gate gets its own commit.
- No skipping gates.
- No "I'll fix it in a follow-up."
- If a gate fails, the work is not done. Fix it before moving on.
- Browser-verification is the final gate. "It compiles" is never sufficient.

---

## THE SCORECARD HONESTY

| Dimension | Now (pre-Stage 1) | Target (post-Stage 1) | End-state |
|---|---|---|---|
| Engineering foundation | 8.5 | 8.5 | 9.5 |
| UI | 8 | 8 | 9 |
| Architecture | 8 | 8.5 | 9.5 |
| Real integrations | 4 | 5 | 9 |
| AI experience | 5 | 7 | 9.5 |
| Actual business value | 5 | 7 | 9.5 |
| **Overall** | **~6.5–7** | **~7.5** | **~9.5** |

The 7→10 journey is **5 workflows**, not 600,000 lines. Discipline, not volume.

---

*This constitution is permanent. It supersedes any prior plan, TODO, or impulse to "just add one more page." When in doubt, read this document.*
