# Roadmap: CareLedger

## Overview

CareLedger is structured into five agile, test-driven phases that take the project from zero to a fully deployed, production-grade MVP within the hackathon timeframe. Each phase delivers a complete functional layer backed by automated tests, deterministic state validation, and measurable verification criteria.

## Phases

- [ ] **Phase 1: Foundation, Data Layer & Authentication (P0)** - Next.js 15, Tailwind, Supabase schema & RLS, Auth & Role linking.
- [ ] **Phase 2: Core Medication & Deterministic Dose Engine (P0)** - Medication CRUD, scheduling rules, deterministic 4-state dose engine, audit transitions.
- [ ] **Phase 3: Elder-Friendly & Caregiver Dashboards (P0)** - High-contrast touch UI for seniors, detailed caregiver command center, appointments.
- [ ] **Phase 4: Reminder Engine & Caregiver Alert Escalation (P0)** - Transactional email reminders, overdue dose detection, caregiver alert notifications.
- [ ] **Phase 5: Collaborative Claiming, Audit Trail & Vercel Deployment (P1 + Ship)** - Alert claim workflows, shared care timeline, audit views, production build & deployment.

---

## Phase Details

### Phase 1: Foundation, Data Layer & Authentication
**Goal**: Establish Next.js 15 project structure, TypeScript configuration, testing framework, Supabase database migrations with PostgreSQL schema and Row-Level Security, and dual-role authentication (Elder vs Caregiver) with care-linking.  
**Depends on**: Nothing (greenfield)  
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04  
**Success Criteria**:
  1. Next.js app builds cleanly with zero TypeScript errors.
  2. Supabase schema migration executes cleanly with tables: `profiles`, `care_relationships`, `medications`, `medication_schedules`, `dose_logs`, `appointments`, `caregiver_alerts`, `audit_logs`.
  3. RLS policies ensure data isolation: caregivers only view linked elders; elders only view their own records.
  4. Unit test suite passes verifying auth helpers, schema definitions, and client initialization.
**Plans**:
- [ ] 01-01: Initialize Next.js 15 App with Tailwind CSS, Lucide icons, Vitest test suite.
- [ ] 01-02: Author comprehensive Supabase SQL schema migrations and RLS policies.
- [ ] 01-03: Implement authentication provider, session handling, user profiles, and elder-caregiver linking code.

### Phase 2: Core Medication & Deterministic Dose Engine
**Goal**: Build the complete medication management and deterministic 4-state dose tracking engine with strict audit trail.  
**Depends on**: Phase 1  
**Requirements**: MED-01, MED-02, MED-03, MED-04, DOSE-01, DOSE-02, DOSE-03, DOSE-04, DOSE-05  
**Success Criteria**:
  1. Medications can be created, updated, and deactivated with dosage notes.
  2. Dosage schedules generate expected daily slots (`morning`, `afternoon`, `evening`, `bedtime` or HH:MM).
  3. Dose state transitions strictly enforce: `not_yet` -> `taken`, `not_yet` -> `unsure`, `not_yet` -> `unconfirmed`, `unsure` -> `taken`, `unconfirmed` -> `taken`.
  4. System NEVER automatically marks a dose as `taken` during scheduled reminders.
  5. 100% test coverage over state machine transition validator and audit trail emitter.
**Plans**:
- [ ] 02-01: Create medication and schedule service layer with validation schemas (Zod).
- [ ] 02-02: Implement deterministic dose state engine with immutable audit logging.
- [ ] 02-03: Write comprehensive unit test suite verifying all valid and invalid state transitions.

### Phase 3: Elder-Friendly & Caregiver Dashboards
**Goal**: Deliver specialized UIs for both elders (high accessibility, large touch targets, minimal cognitive burden) and caregivers (dense oversight, adherence indicators, multi-elder selector, appointments).  
**Depends on**: Phase 2  
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, APT-01, APT-02, APT-03  
**Success Criteria**:
  1. Elder view meets WCAG AAA guidelines (contrast >= 7:1, buttons >= 48px, text >= 18px).
  2. Elder can record "I took this", "Not yet", or "I'm not sure" in a single touch.
  3. Caregiver view displays real-time adherence percentages and alerts for all linked elders.
  4. Appointments can be scheduled, viewed, and updated with companion notes.
**Plans**:
- [ ] 03-01: Implement Elder Dashboard with high-contrast tactile dose cards and quick emergency contact.
- [ ] 03-02: Implement Caregiver Dashboard with patient switching, adherence metrics, and medication management.
- [ ] 03-03: Implement Appointment management modal and chronological timeline.

### Phase 4: Reminder Engine & Caregiver Alert Escalation
**Goal**: Implement email notification dispatch and automated overdue/unsure dose detection that creates caregiver alerts.  
**Depends on**: Phase 3  
**Requirements**: REM-01, REM-02, ALERT-01, ALERT-02, ALERT-03  
**Success Criteria**:
  1. Email service sends formatted medication reminders and appointment alerts (with mock logging in dev/test).
  2. Escalation runner evaluates scheduled doses: if dose window passed and state is not `taken`, status becomes `unconfirmed` and opens a caregiver alert.
  3. Any dose marked `unsure` immediately triggers a priority caregiver alert.
  4. Caregiver dashboard highlights active alerts with visual indicators.
**Plans**:
- [ ] 04-01: Build email reminder service with clean templates and dual-provider adapter (Resend + Local Mock).
- [ ] 04-02: Implement overdue dose detection engine and alert generator.
- [ ] 04-03: Wire alerts into caregiver interface with real-time badges.

### Phase 5: Collaborative Claiming, Audit Trail & Vercel Deployment
**Goal**: Implement caregiver claim responsibility, shared care timeline, complete audit log inspection, end-to-end verification, and production build/deployment.  
**Depends on**: Phase 4  
**Requirements**: CLAIM-01, CLAIM-02, CLAIM-03, AUDIT-01, AUDIT-02, AUDIT-03  
**Success Criteria**:
  1. Caregivers can claim an active alert to prevent duplicate calls/visits; claim records timestamp and caregiver ID.
  2. Caregiver can resolve claimed alerts with notes and confirm actual dose status.
  3. Shared Care Timeline visualizes all actions chronologically for the family.
  4. Production build (`npm run build`) compiles cleanly with zero warnings or errors.
  5. Deployment configuration ready for Vercel.
**Plans**:
- [ ] 05-01: Implement caregiver alert claim & resolution workflow with notes.
- [ ] 05-02: Build Shared Care Timeline and immutable Audit Log explorer.
- [ ] 05-03: Run end-to-end test verification, build optimization, and Vercel deployment check.
