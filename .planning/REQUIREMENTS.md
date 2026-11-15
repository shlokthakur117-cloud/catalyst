# Requirements: CareLedger

**Defined:** 2026-11-15  
**Core Value:** Deterministic medication dose certainty with elder-accessible interfaces and real-time caregiver accountability.

## v1 Requirements (Hackathon MVP)

### Authentication & Access Control (P0)

- [ ] **AUTH-01**: User can register as either an "Elder" or a "Caregiver" with secure credentials.
- [ ] **AUTH-02**: Caregiver can link to an Elder account via unique invite code or verified email relationship.
- [ ] **AUTH-03**: Elder can access an ultra-simple, high-accessibility session interface.
- [ ] **AUTH-04**: Row-Level Security (RLS) strictly prevents cross-elder data leakage; caregivers only access authorized elders.

### Medication & Schedule Management (P0)

- [ ] **MED-01**: Caregiver or elder can record medications with name, strength, dosage instructions, prescribing doctor, and warnings.
- [ ] **MED-02**: Users can create recurring dosage schedules (time of day: Morning, Afternoon, Evening, Bedtime or exact HH:MM, days of week).
- [ ] **MED-03**: Medications can be edited, marked as active, or discontinued with an audit trail.
- [ ] **MED-04**: System generates scheduled dose slots deterministically for any requested date range.

### Deterministic Dose Tracking (P0)

- [ ] **DOSE-01**: Doses are generated in a pending state (`not_yet`).
- [ ] **DOSE-02**: Elder or Caregiver can transition a dose explicitly to:
  - `taken`: Medication verified swallowed/administered.
  - `not_yet`: Explicitly deferred by user with reason.
  - `unsure`: Elder expresses confusion or cannot remember.
  - `unconfirmed`: Dose window elapsed without response.
- [ ] **DOSE-03**: Deterministic transition engine rejects invalid transitions and logs every change with actor identity and timestamp.
- [ ] **DOSE-04**: System NEVER automatically marks a dose as `taken` upon reminder delivery.
- [ ] **DOSE-05**: Doses marked `unsure` or remaining `unconfirmed` immediately flag an escalation candidate.

### Dashboards & UI (P0)

- [ ] **DASH-01**: Elder Dashboard conforms to accessibility standards (large touch targets >= 48px, high contrast WCAG AAA, clear typography >= 18px).
- [ ] **DASH-02**: Elder Dashboard presents immediate "Today's Next Doses" with simple one-touch confirmation buttons ("I took this", "Not yet", "I'm not sure").
- [ ] **DASH-03**: Elder Dashboard displays upcoming appointments and single-touch emergency caregiver contact.
- [ ] **DASH-04**: Caregiver Dashboard displays a birds-eye overview of linked elders, medication adherence rate, and active alert badges.
- [ ] **DASH-05**: Caregiver can seamlessly switch between multiple linked elder profiles.

### Appointments (P0)

- [ ] **APT-01**: Caregivers or elders can create and view medical appointments (title, specialist, clinic/location, date/time).
- [ ] **APT-02**: Appointments support companion notes and transportation requirements.
- [ ] **APT-03**: Appointments appear chronologically in both elder and caregiver views with status indicators.

### Reminders & Alerts (P0)

- [ ] **REM-01**: Email reminder dispatch system triggers scheduled notifications for upcoming doses.
- [ ] **REM-02**: Email notifications alert caregivers when appointments are scheduled or modified.
- [ ] **ALERT-01**: Escalation worker detects overdue dose windows and creates a high-priority `caregiver_alerts` record.
- [ ] **ALERT-02**: Doses marked `unsure` trigger immediate caregiver alert notifications with elder notes.
- [ ] **ALERT-03**: Caregiver dashboard prominently displays unresolved alert banners with sound/visual indicators.

### Caregiver Responsibility & Escalation (P1)

- [ ] **CLAIM-01**: Caregiver can "Claim Responsibility" for an active alert, updating status to `claimed` to prevent duplicate family effort.
- [ ] **CLAIM-02**: Claimed alerts record the caregiver's name, claim timestamp, and allow follow-up resolution notes.
- [ ] **CLAIM-03**: Caregiver can resolve an alert once verified with the elder, transitioning dose state if confirmed.

### Care Timeline & Audit Log (P1)

- [ ] **AUDIT-01**: Immutable audit log tracks every modification to medications, schedules, dose states, and alert claims.
- [ ] **AUDIT-02**: Shared Care Timeline provides a unified chronological feed of all care events for family members.
- [ ] **AUDIT-03**: Medication changes record previous vs updated values and author.

## Traceability Matrix

| Requirement | Phase | Priority | Status |
|-------------|-------|----------|--------|
| AUTH-01, AUTH-02, AUTH-03, AUTH-04 | Phase 1: Foundation & Auth | P0 | Pending |
| MED-01, MED-02, MED-03, MED-04 | Phase 2: Medication & Dose Engine | P0 | Pending |
| DOSE-01, DOSE-02, DOSE-03, DOSE-04, DOSE-05 | Phase 2: Medication & Dose Engine | P0 | Pending |
| DASH-01, DASH-02, DASH-03 | Phase 3: Dashboards & Appointments | P0 | Pending |
| DASH-04, DASH-05 | Phase 3: Dashboards & Appointments | P0 | Pending |
| APT-01, APT-02, APT-03 | Phase 3: Dashboards & Appointments | P0 | Pending |
| REM-01, REM-02, ALERT-01, ALERT-02, ALERT-03 | Phase 4: Reminders & Alerts | P0 | Pending |
| CLAIM-01, CLAIM-02, CLAIM-03 | Phase 5: Collaboration, Audit & Deploy | P1 | Pending |
| AUDIT-01, AUDIT-02, AUDIT-03 | Phase 5: Collaboration, Audit & Deploy | P1 | Pending |
