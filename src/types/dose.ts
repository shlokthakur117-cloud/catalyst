/**
 * CareLedger Deterministic Dose State Model
 *
 * System-generated states:
 * - scheduled: Slot generated for an active prescription
 * - reminded: Notification dispatched (explicitly NOT proof of ingestion)
 * - unconfirmed: Grace period expired without affirmative confirmation
 *
 * User/Actor-reported states:
 * - taken: Actor affirmatively confirmed ingestion
 * - not_yet: User requested delay / snoozed dose
 * - unsure: Elder expressed confusion or uncertain recollection
 * - skipped: Intentionally withheld or cancelled (e.g. physician advice, nausea)
 */
export type DoseStatus =
  | "scheduled"
  | "reminded"
  | "taken"
  | "not_yet"
  | "unsure"
  | "unconfirmed"
  | "skipped";

export type DoseActorRole = "elder" | "caregiver" | "system";

export interface DoseStateTransitionRequest {
  doseId: string;
  fromStatus: DoseStatus;
  toStatus: DoseStatus;
  actorId: string;
  actorRole: DoseActorRole;
  notes?: string;
  timestamp?: string; // ISO 8601 string
}

export interface DoseTransitionResult {
  success: boolean;
  previousStatus: DoseStatus;
  currentStatus: DoseStatus;
  transitionedAt: string;
  actorId: string;
  actorRole: DoseActorRole;
  requiresCaregiverAlert: boolean;
  notes?: string;
}

export interface DoseRecord {
  id: string;
  scheduleId: string;
  medicationId: string;
  elderId: string;
  medicationName: string;
  dosage: string;
  scheduledFor: string; // ISO 8601 string
  status: DoseStatus;
  remindedAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  actorRole?: DoseActorRole | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoseAuditEntry {
  id: string;
  doseId: string;
  elderId: string;
  fromStatus: DoseStatus;
  toStatus: DoseStatus;
  actorId: string;
  actorRole: DoseActorRole;
  notes?: string;
  timestamp: string;
}
