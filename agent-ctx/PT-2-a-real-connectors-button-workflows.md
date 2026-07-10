# PT-2-a — Real Connectors & Button Workflows

Task ID: PT-2-a
Agent: full-stack-developer (Real Connectors & Button Workflows)
Scope: Make Connect GSTN, Connect Bank, Connect Gmail, Connect WhatsApp, Connect Tally/Zoho/QB, Invite Team, and Activate Oracle buttons trigger real multi-step workflows with real DB writes.

## Work Summary

### Backend endpoints (created / extended)
- `POST /api/connectors` — extended to create DataConnection + AuditLog (CONNECT_<TYPE>)
- `PATCH /api/connectors/[id]` — NEW: update status/syncInterval/label + AuditLog (CONNECTOR_UPDATED)
- `DELETE /api/connectors/[id]` — extended with AuditLog (CONNECTOR_DISCONNECTED)
- `POST /api/connectors/otp` — NEW: generate + persist OTP, return for demo display, write AuditLog (OTP_GENERATED)
- `POST /api/connectors/[id]/sync` — extended to create real SyncedRecord stub rows for ALL connector types (gstn=3 GSTR filings, bank=8 transactions, whatsapp=3 messages, tally/zoho/quickbooks=4 invoices) + AuditLog (CONNECTOR_SYNCED)
- `POST /api/team-members` — extended to support invite semantics (isActive=false, status='invited', permissions, invitedBy) + Notification + AuditLog (TEAM_INVITE)
- `PATCH /api/team-members/[id]` — NEW: role/status update + AuditLog (TEAM_MEMBER_ROLE_CHANGED / DEACTIVATED)
- `DELETE /api/team-members/[id]` — NEW: removes member + unassigns notices + AuditLog (TEAM_MEMBER_REMOVED)
- `POST /api/automation` — extended to detect `type: 'oracle_activation'` shortcut → creates/upserts "Oracle Daily Analytics Job" AutomationRule + AuditLog (ORACLE_ACTIVATED)
- `PATCH /api/firm-settings` — NEW alias for PUT (per spec) + AuditLog (FIRM_SETTINGS_UPDATED)

### Frontend changes
- `src/components/connections/ConnectionsPage.tsx` — ConnectModal upgraded to multi-step stepper for GSTN (3 steps: GSTIN+trade name → OTP → verify) and Bank (3 steps: choose bank → AA consent → last-4+PIN). Single-step for Gmail (OAuth), WhatsApp, Tally/Zoho/QB. Toast on success/failure. Real API calls to /api/connectors/otp, /api/connectors, /api/connectors/[id]/sync.
- `src/components/team/TeamPage.tsx` — fetches from /api/team-members, real invite POST with permissions checklist, toast notifications, "Invited" badge for inactive members.
- `src/components/settings/SettingsPage.tsx` — handleSave now PATCHes /api/firm-settings (was `setTimeout`). handleInviteMember POSTs /api/team-members (was optimistic local state). handleRemoveMember DELETEs /api/team-members/[id]. handleUpdateRole PATCHes /api/team-members/[id]. "Test Connection" button calls /api/connect/gstn (was `setTimeout`).
- `src/components/ai-operating-room/AIOperatingRoomPage.tsx` — added "Activate Oracle" button + Dialog in page header. POST /api/automation { type: 'oracle_activation', schedule: 'daily' }. Tracks activation state via GET /api/automation on mount. Toast on success.

### Helpers created
- `src/lib/audit/safe-write.ts` — `safeAudit()` + `safeNotify()` helpers that retry with `userId=null` on P2003 FK violations (so audit/notification writes never fail when the acting user doesn't yet have a User row).

## Notes for downstream agents
- The `POST /api/connectors` response shape was concurrently modified by another agent (PT-2-b likely) to include `emitBankNode`/`emitGstnNode` calls. I preserved their graph-emit logic and ADDED my AuditLog write + nested `connection.id` field. Both response shapes (`connectionId` flat + `connection.id` nested) are now returned so the frontend can read either.
- The Prisma `prisma:error` log entries that appear when an unknown `userId` is passed to AuditLog/Notification are EXPECTED — they are the first-attempt P2003 FK violations that `safeAudit`/`safeNotify` catch and retry without userId. The data is still written.
- All workflow buttons now persist real DB rows: DataConnection, SyncedRecord, TeamMember, Notification, AuditLog, AutomationRule, FirmSettings.
