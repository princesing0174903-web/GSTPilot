# Task 4-a: API Routes for GSTPilot CA Firm Operations Layer

## Summary
Created 5 API route files for the CA Firm Operations Layer, all using Prisma with SQLite and proper TypeScript error handling.

## Files Created

### 1. `/src/app/api/firm-operations/route.ts`
- **GET**: Returns firm operations metrics
- Uses FirmMetrics table when available (latest period)
- Fallback: calculates from Invoice (totalAmount sum), Client (status counts), WorkloadAssignment (utilization), TeamPerformance (avg turnaround)
- Returns: totalRevenue, MRR, ARR, clientsOnboarded, activeClients, inactiveClients, teamUtilization, avgProcessingTime, avgFilingTime, gstProcessed, profitability, clientGrowth

### 2. `/src/app/api/team-performance/route.ts`
- **GET**: Team performance leaderboard
- Lists all active TeamMembers with latest TeamPerformance
- Aggregated metrics per member via Promise.all
- Weighted performance score: accuracy(30%) + volume(25%) + speed(25%) + reviews(20%)
- Includes workload counts (pending, in_progress, completed)
- Sorted by score descending with rank

### 3. `/src/app/api/workload/route.ts`
- **GET**: WorkloadAssignments grouped by teamMemberId with summary stats
- **POST**: Create assignment (validates teamMemberId, entityType, title; verifies member exists)
- **PATCH**: Update status (auto-sets completedAt when status='completed')

### 4. `/src/app/api/notices/route.ts`
- **GET**: Notices with client tradeName + assignee name; filters: status, noticeType, clientId, assignedTo
- **POST**: Create notice (validates clientId, subject; verifies client and assignee)
- **PATCH**: Update notice (auto-sets responseDate when status='resolved')

### 5. `/src/app/api/team-members/route.ts`
- **GET**: TeamMembers with latest performance; filters: role, department, isActive
- **POST**: Create member (validates name, email; duplicate email returns 409)

## Other Changes
- Updated `src/lib/db.ts` to detect stale PrismaClient instances (checks for `firmMetrics` property) and replace with fresh client

## Verification
- `bun run lint` passes clean (0 errors, 0 warnings)
- All 5 GET endpoints tested via curl and return correct JSON
- POST /api/workload tested and returns 201 with created assignment
- POST /api/team-members tested and returns 201 with created member
