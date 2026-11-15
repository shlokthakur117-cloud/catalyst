# Project State: CareLedger

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-11-15)

**Core value:** Deterministic medication dose certainty: guaranteeing reminders never masquerade as ingestion, every dose state is accurately logged, and any unresolved dose immediately alerts authorized caregivers.  
**Current focus:** Final Phase 3 Authorization Integration Gate Fully Cleared (All 10 Real-Database Scenarios Passed with 100% Success)

## Current Position

Phase: Final Phase 3 Authorization Integration Gate — Authenticated RLS & Real Invitation Concurrency  
Plan: Live Supabase Authenticated Authorization Gate  
Status: 100% Complete & Formally Verified  
Last activity: 2026-11-15 — Final Phase 3 Authorization Integration Gate cleared:
1. Authenticated 4 isolated live Supabase accounts (Elder A, Elder B, Caregiver A, Caregiver B) via GoTrue with authentic user JWT tokens.
2. Verified all 10 live authorization scenarios over real REST/PostgREST queries:
   - Elder A accesses own records; Elder B cannot read Elder A records (0 rows returned).
   - Caregiver A (unlinked) cannot read Elder A records (0 rows returned).
   - Elder A generates invitation -> Caregiver A claims invite via atomic RPC -> Caregiver A has authorized read access to Elder A medications and dose logs.
   - Caregiver A cannot read Elder B records (0 rows returned).
   - Caregiver B cannot read Caregiver A private profile (0 rows returned).
   - Database-level trigger `trg_enforce_elder_only_taken` rejects direct caregiver REST updates to set `status = 'taken'`.
   - Elder A revokes Caregiver A -> Caregiver A immediately loses all read access (0 rows returned).
   - Invitation Concurrency: Concurrent claims on a single pending invite via `Promise.all` result in exactly 1 claim succeeding and exactly 1 failing with row-lock protection (`SELECT ... FOR UPDATE`), with `invite_code` atomically wiped to NULL.
   - Boundary Rejections: Self-claim, expired invites, and re-claims of claimed invites are strictly rejected.
3. Fixed email queue reliability in `notification-service.ts` and `escalation-runner.ts`: never claims delivery if provider (Resend) is unconfigured or fails; counts only successfully delivered emails.
4. Clean test baseline: 166 passing tests across 21 test files in `npm test`, clean `npx tsc --noEmit` (0 errors), clean Next.js 15 production build (`npm run build`).

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total test files: 21 / 21 passing (100%)
- Total tests: 166 / 166 passing (100%)
- TypeScript check: 0 errors
- Production build: Clean Next.js 15 App Router compilation (14 static & dynamic routes)

**By Phase:**

| Phase | Plans | Status | Deliverables |
|---|---|---|---|
| 1. Foundation & Auth | 3/3 (100%) | Verified | Next.js 15, Supabase Schema, RLS, PBKDF2 600k PIN security, Auth & linking |
| 2. Medication & Dose Engine | 3/3 (100%) | Verified | Zod schemas, 7-state dose engine, optimistic conditional queries, dose engine tests |
| 3. Dashboards & Appointments | 3/3 (100%) | Verified | Elder WCAG AAA touch interface, Caregiver Command Center, Medical appointments |
| 4. Reminders & Alerts | 3/3 (100%) | Verified | Pluggable Resend email service, Overdue cron runner (`/api/cron/escalate`), Caregiver Alert Feed |
| 5. Collaboration, Audit & Deploy | 3/3 (100%) | Verified | Responsibility claim & resolution, Shared Care Timeline & Audit Log, Vercel deployment |
| Security Gate: Phase 3 Integration | 1/1 (100%) | Cleared | Live GoTrue JWT authentication, RLS isolation, atomic invitation concurrency RPC, database trigger |

## Accumulated Context

### Architectural Principles Upheld
- **Clinical Invariant**: Reminders never imply ingestion. Automated jobs never mark a dose as `taken`.
- **Elder-Only Taken Invariant**: Enforced at the database layer via PostgreSQL trigger `trg_enforce_elder_only_taken` on `public.dose_logs` (`auth.uid() == elder_id`). Caregiver follow-ups and observations remain separate audited events and cannot alter adherence numerator.
- **Atomic Concurrency & Single-Use**: `public.claim_elder_invitation` uses `SELECT ... FOR UPDATE` row locking and erases `invite_code` to `NULL` on activation.
- **Email Delivery Honesty**: If Resend is unconfigured or fails, notification service returns explicit error and never falsely claims delivery.
- **Append-Only Immutability**: All care events emit immutable before/after diff records into `public.audit_logs` where UPDATE and DELETE are prohibited by RLS.
