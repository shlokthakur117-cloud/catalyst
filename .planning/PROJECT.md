# CareLedger

## What This Is

CareLedger is a resilient, elder-first medication management and collaborative care coordination platform. It bridges the gap between aging seniors who need simple, dignified daily tracking and the family or professional caregivers who need real-time certainty, accountability, and escalation for unresolved doses.

## Core Value

Deterministic tracking of reported medication confirmations and unresolved medication events: guaranteeing that reminders never masquerade as ingestion, every reported dose state is accurately logged, and any unresolved medication event immediately alerts authorized caregivers before it becomes a medical risk.

## Requirements

### Validated

(None yet — building initial hackathon MVP)

### Active

- [ ] Dual-role authentication (Elder vs Caregiver) with secure family care linking (AUTH-01 to AUTH-04)
- [ ] Comprehensive medication catalog and recurring schedule management (MED-01 to MED-04)
- [ ] Deterministic dose state machine (`Taken`, `Not yet`, `Unsure`, `Unconfirmed`) with strict auditing (DOSE-01 to DOSE-05)
- [ ] Elder-friendly dashboard with high contrast, large touch targets, and clear status feedback (DASH-01 to DASH-03)
- [ ] Caregiver oversight dashboard with real-time status and patient switcher (DASH-04 to DASH-05)
- [ ] Appointment management for doctor visits with companion notes (APT-01 to APT-03)
- [ ] Automated email reminders for doses and upcoming appointments (REM-01 to REM-03)
- [ ] Unresolved dose alert engine and caregiver escalation system (ALERT-01 to ALERT-03)
- [ ] Caregiver responsibility claim workflow for open alerts (CLAIM-01 to CLAIM-03)
- [ ] Shared care timeline and tamper-evident audit log (AUDIT-01 to AUDIT-03)
- [ ] Medication modification approval & history tracking (APPR-01 to APPR-02)

### Out of Scope

- Nonessential AI chat assistants — adds hallucination risk and complexity for elder dose safety
- Wearable and IoT pill dispenser hardware integration — out of scope for 7-hour hackathon window
- Voice recognition/audio parsing — brittle in ambient noise; tactile interface prioritized
- Predictive adherence machine learning models — rule-based determinism is safer for medication logs

## Context

- Hackathon timeline: ~7 hours to final submission.
- Target audience: Seniors (65+) experiencing mild cognitive decline or motor stiffness, paired with family caregivers managing care remotely.
- Key UX requirement: Ultra-clean, high-legibility interface with minimal cognitive burden for the elder, balanced by dense, actionable data for caregivers.

## Constraints

- **Tech Stack**: Next.js 15+ (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth), Vercel.
- **Dose Integrity**: Reminders are NOT proof of ingestion. A dose cannot be marked `Taken` automatically.
- **Security**: PostgreSQL Row-Level Security (RLS) must enforce that caregivers can only access linked elders, and elders cannot access other patients' data.
- **Time Window**: 7 hours total; deploy early vertical slice and lock down tests.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router + TypeScript | Full-stack server components, type-safety, rapid Vercel deployment | — Pending |
| Supabase PostgreSQL + RLS | Bulletproof relational schema, patient-caregiver isolation, auditable logs | — Pending |
| 4-State Dose Machine (`not_yet`, `taken`, `unsure`, `unconfirmed`) | Captures nuanced elder reality (confusion vs deliberate delay vs confirmation) | — Pending |
| Dual-Adapter Email & Notifications | Resend production adapter with local mock logger for offline test resilience | — Pending |

---
*Last updated: 2026-11-15 during GSD initialization*
