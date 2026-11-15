# CareLedger MVP Architecture

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Next.js 15 App Router)"]
        ElderUI["Elder Interface (WCAG AAA High Contrast, Touch >=48px)"]
        CaregiverUI["Caregiver Interface (Adherence Analytics, Multi-Elder Selector)"]
        SharedUI["Shared Care Timeline & Appointments"]
    end

    subgraph AppServer["Application Layer (Next.js Server Components / Actions)"]
        AuthHandler["Auth & Role Gate (Elder vs Caregiver)"]
        DoseEngine["Deterministic Dose State Machine"]
        AlertEscalation["Alert & Overdue Detector"]
        AuditEmitter["Immutable Audit Logger"]
        EmailService["Email Notification Dispatcher (Resend / Mock)"]
    end

    subgraph DataLayer["Persistence Layer (Supabase PostgreSQL + RLS)"]
        ProfilesTable["profiles (roles, contact, emergency pin)"]
        RelationshipsTable["care_relationships (elder_id, caregiver_id)"]
        MedsTable["medications (rx, dosage, warnings)"]
        SchedulesTable["medication_schedules (recurrence, times)"]
        DosesTable["dose_logs (taken, not_yet, unsure, unconfirmed)"]
        AlertsTable["caregiver_alerts (open, claimed, resolved)"]
        AuditTable["audit_logs (actor, before/after jsonb, timestamp)"]
    end

    ElderUI -->|One-touch action| DoseEngine
    CaregiverUI -->|Claim alert / View adherence| DoseEngine
    CaregiverUI -->|Manage Rx & Schedules| AppServer

    DoseEngine -->|Deterministic transition| DosesTable
    DoseEngine -->|Log changes| AuditEmitter
    AuditEmitter -->|Append only| AuditTable

    AlertEscalation -->|Scan overdue slots| DosesTable
    AlertEscalation -->|Create alert if unsure/unconfirmed| AlertsTable
    AlertEscalation -->|Dispatch alert email| EmailService
```

## 2. Deterministic Dose State Machine

```mermaid
stateDiagram-v2
    [*] --> not_yet: Scheduled Dose Slot Created

    not_yet --> taken: Elder/Caregiver confirms "I took this"
    not_yet --> unsure: Elder taps "I'm not sure"
    not_yet --> unconfirmed: Dose window expires without action

    unsure --> taken: Caregiver calls elder & verifies ingestion
    unsure --> not_yet: Caregiver determines dose should be taken now
    unsure --> unconfirmed: Unresolved after escalation window

    unconfirmed --> taken: Verified late ingestion
    unconfirmed --> not_yet: Rescheduled by caregiver

    taken --> [*]: Confirmed & Audited
```

### Critical Invariants:
1. **Never Ingest by Notification**: Scheduled notifications or email reminders NEVER transition a dose to `taken`.
2. **Actor Attribution**: Every transition records `logged_by` (user ID), `logged_at` (ISO timestamp), and optional notes.
3. **Escalation Trigger**: Transitions to `unsure` or timeout into `unconfirmed` automatically generate a `caregiver_alerts` record.

## 3. Database Schema & Row-Level Security (RLS)

- **`profiles`**: Stores `id` (references `auth.users`), `email`, `full_name`, `role` (`'elder'` | `'caregiver'`), `phone`, `emergency_notes`, `created_at`.
- **`care_relationships`**: Links `elder_id` and `caregiver_id`. Caregivers can only read/write data for elders with whom an `'active'` relationship exists.
- **`medications`**: Prescriptions tied to an `elder_id`. Only the elder or their authorized caregivers can view/manage.
- **`medication_schedules`**: Recurring schedules tied to a `medication_id` and `elder_id`.
- **`dose_logs`**: Individual daily scheduled instances. Stores `scheduled_for`, `status` (`'not_yet'`, `'taken'`, `'unsure'`, `'unconfirmed'`), `logged_by`, `logged_at`, `notes`.
- **`caregiver_alerts`**: Created for overdue or unsure doses. Tracks `status` (`'open'`, `'claimed'`, `'resolved'`), `claimed_by`, `claimed_at`, `resolved_at`, `resolution_notes`.
- **`appointments`**: Medical visits, transportation notes, and doctor info for an elder.
- **`audit_logs`**: Append-only log with `user_id`, `elder_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `created_at`.

## 4. Technology Stack & Tooling

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 15 (App Router) | High performance React Server Components, Server Actions, modern routing |
| Language | TypeScript 5 | Strict type safety across dose state transitions and database models |
| Styling | Tailwind CSS | Fast, accessible utility styling for large touch targets and contrast |
| Database & Auth | Supabase PostgreSQL + RLS | Secure, relational data with row-level permission isolation |
| Testing | Vitest + React Testing Library | Fast unit and integration tests for state machine and RLS security rules |
| Deployment | Vercel | Seamless edge/serverless hosting with automated CI |
| Code Quality | CodeRabbit CLI | Autonomous code review and security auditing |
| Execution Loop | Ralph Loop | Test-driven, bounded iterative development |
