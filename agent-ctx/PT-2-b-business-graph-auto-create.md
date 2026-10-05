# PT-2-b — Business Graph Auto-Create from Real Data

**Task ID**: PT-2-b
**Agent**: full-stack-developer (Business Graph Auto-Create)
**Phase**: Production Transformation Phase (PT-*)

## Mission
Every Client, Invoice, Bank Account (DataConnection type=bank), GST Return (GSTRFiling),
Collection (Payment), Notice, Employee, and Task (AITask) must automatically become a
node in the Business Graph whenever it is created. The graph must update in real time.

## Architecture Insight
The Business Graph in `/lib/graph/engine.ts` is computed LIVE from real DB rows via
`fetchRawRows() → buildKnowledgeGraph()` with a 60s in-memory cache (`/lib/graph/cache.ts`).
There is NO `GraphNode` Prisma model — nodes are derived.

So "emitting a graph node" means:
1. Verify the entity exists in Prisma (defensive — caller just created it).
2. Push a `LiveGraphEvent` into the in-memory log (which also invalidates the 60s cache).
3. The next `/api/graph` read re-derives the graph from real DB rows — including the new one.

The `relatedNodeIds` list on each event encodes the edges the engine will draw
(Client↔Invoice, Client↔GSTRFiling, Client↔Collection, Client↔Notice, Firm↔Employee,
Employee↔Task, Bank↔Collection, etc.).

## Files Created
- `/src/lib/graph/auto-emit.ts` — canonical emit helpers (one per entity type) + `backfillAllGraphNodes()`
- `/src/app/api/graph/backfill/route.ts` — POST endpoint that scans the full DB and emits a node for every existing entity

## Files Modified
- `/src/lib/graph/engine.ts` — extended RawRows + fetchRawRows (added AITasks, clientId on Payment, identifier on DataConnection); added section 2b (real bank DataConnection nodes); added section 12b (real AITask task nodes with Employee→Task ASSIGNED_TO + Client→Task AFFECTS edges); added Client→Collection PAYS direct edge in section 11
- `/src/app/api/clients/route.ts` — POST now calls `emitClientNode(client.id)` after existing create
- `/src/app/api/invoices/route.ts` — POST (both Invoice Cloud™ branch + original GST branch) now calls `emitInvoiceNode(invoice.id)`
- `/src/app/api/gstr-filing/route.ts` — POST now calls `emitGstReturnNode(filing.id)` (was missing graph emit entirely)
- `/src/app/api/payments/route.ts` — POST now calls `emitCollectionNode(payment.id)`
- `/src/app/api/notices/route.ts` — POST now calls `emitNoticeNode(notice.id)`
- `/src/app/api/payroll/route.ts` — POST (new-employee branch) now calls `emitEmployeeNode(employee.id)`
- `/src/app/api/ai-tasks/route.ts` — POST now calls `emitTaskNode(task.id)` (was missing graph emit entirely)
- `/src/app/api/connectors/route.ts` — kept existing GET unchanged; added POST create route that creates DataConnection + calls `emitBankNode` (type=bank) or `emitGstnNode` (type=gstn) or `invalidateGraph` (other types)

## Emit Helpers (in /lib/graph/auto-emit.ts)
- `emitClientNode(clientId)` — Client node + business↔client OWNS edge
- `emitInvoiceNode(invoiceId)` — Invoice node + business→invoice GENERATES + client→invoice RECEIVES
- `emitGstReturnNode(filingId)` — gst-return node + client→gst-return FILES + gst-return→business GENERATES_LIABILITY
- `emitCollectionNode(paymentId)` — collection/payment node + client→collection PAYS + collection→invoice CLEARS + collection→bank RECORDED_IN
- `emitNoticeNode(noticeId)` — notice node + client→notice RESPONDS_TO + notice→business AFFECTS
- `emitEmployeeNode(employeeId)` — employee node + business→employee OWNS
- `emitTaskNode(taskId)` — task node + business→task CREATED_BY + employee→task ASSIGNED_TO + client→task AFFECTS
- `emitBankNode(connectionId)` — bank-account node + business→bank OWNS (DataConnection type=bank only)
- `emitGstnNode(connectionId)` — gstn connection event (DataConnection type=gstn only)
- `backfillAllGraphNodes()` — batch-emits nodes for every existing entity in the DB

## Engine Extensions (in /lib/graph/engine.ts)
1. **RawRows interface**: added `tasks: AITask[]`, added `clientId: string | null` to payments, added `identifier: string | null` to dataConnections
2. **fetchRawRows()**: added `db.aITask.findMany(...)` to the Promise.all
3. **Section 2b** (new): real DataConnection type=bank → `bank-account:${dc.id}` node with business→bank OWNS edge
4. **Section 11** (extended): when Payment has clientId, draw `client:${clientId} → collection:${p.id}` PAYS edge
5. **Section 12b** (new): real AITask records → `task:${t.id}` nodes with business→task CREATED_BY + employee→task ASSIGNED_TO (when assignedTo) + client→task AFFECTS (when clientId). Dedup guard vs existing CFO priorityActions task nodes.

## Edges Wired (spec requirement → implementation)
- ✅ Client → Invoice (RECEIVES) — existing, confirmed working
- ✅ Client → GSTRFiling (FILES) — existing, confirmed working
- ✅ Client → Collection (PAYS) — **NEW PT-2-b** — added in section 11
- ✅ Client → Notice (RESPONDS_TO) — existing, confirmed working
- ✅ Firm → Employee (OWNS) — existing, confirmed working
- ✅ Employee → Task (ASSIGNED_TO) — **NEW PT-2-b** — added in section 12b
- ✅ Bank → Collection (RECORDED_IN) — existing (collection → bank-account:primary), confirmed working

## Smoke Test Results (curl, all HTTP 200/201)
Created via POST:
- Client "Graph Test Co PT2B" (gstin 27AABCS1429B1ZX)
- Invoice "INV-PT2B-001" (₹1,18,000)
- GSTRFiling "GSTR-1 · 2026-07" (₹18,000 tax)
- Notice "PT-2B Test Notice" (high priority, due 2026-08-15)
- Payment ₹50,000 (customer collection, mode=bank)
- Employee "PT2B Test Emp" (Accountant, Finance, ₹50,000 gross)
- AITask "PT2B Test Task" (risk_alert, high priority)
- Bank connector "ICICI Bank ****9876"
- GSTN connector "27AABCS1429B1ZX"

GET /api/graph after creates:
- Total nodes: 23 → 32 (+9 new entities as nodes)
- Total edges: 34 → 48
- New edges from new client: business→client OWNS, client→invoice RECEIVES, client→gst-return FILES, client→notice RESPONDS_TO, client→collection PAYS, client→task AFFECTS

POST /api/graph/backfill:
- Returns {ok: true, emitted: {clients:2, invoices:2, filings:1, payments:2, notices:2, employees:1, tasks:3, banks:2, gstns:1, totalEmitted:16}}

## Quality Bar
- `bun run lint` → **ZERO errors, ZERO warnings**
- Dev server: **running** (Next.js 16.1.3 Turbopack on :3000), zero compile errors, all endpoints 200/201
- All cardinal constraints honored: NO UI redesign, NO new pages (only API route + lib module), NO feature removal, every entity create emits a graph node write — no manual seeding required.

## Cardinal Constraint Compliance
1. ✅ Did NOT redesign the UI (no UI files touched)
2. ✅ Did NOT create new pages (only added /api/graph/backfill route + extended /api/connectors POST)
3. ✅ Did NOT remove any existing feature (all existing graphEvents.* calls preserved; CFO priorityActions task nodes preserved alongside new real AITask nodes)
4. ✅ Kept every screen, animation, card, layout exactly as-is
5. ✅ Every entity create emits a graph node write — no manual seeding required (backfill endpoint exists for legacy seeded data)
