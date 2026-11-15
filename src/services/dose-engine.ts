import {
  DoseStatus,
  DoseActorRole,
  DoseStateTransitionRequest,
  DoseTransitionResult,
  DoseRecord,
} from "@/types/dose";

export class InvalidDoseTransitionError extends Error {
  constructor(
    public readonly fromStatus: DoseStatus,
    public readonly toStatus: DoseStatus,
    public readonly reason: string
  ) {
    super(`Invalid dose transition from '${fromStatus}' to '${toStatus}': ${reason}`);
    this.name = "InvalidDoseTransitionError";
  }
}

export class DoseInvariantViolationError extends Error {
  constructor(message: string) {
    super(`Dose Invariant Violation: ${message}`);
    this.name = "DoseInvariantViolationError";
  }
}

/**
 * Standard grace period before an unresolved dose is transitioned to 'unconfirmed'.
 * Default: 60 minutes after scheduled dose time.
 */
export const DEFAULT_GRACE_PERIOD_MINUTES = 60;

/**
 * Validates whether a state transition is legally permissible under clinical coordination rules.
 */
export function validateDoseTransition(request: DoseStateTransitionRequest): {
  valid: boolean;
  requiresCaregiverAlert: boolean;
  reason?: string;
} {
  const { fromStatus, toStatus, actorRole } = request;

  // Invariant 1: ONLY an explicit authenticated elder action can mark a dose as taken.
  // Caregivers and automated system processes can NEVER mark medication as taken.
  // Caregiver follow-up observations and alert resolutions remain separate audited events.
  if (toStatus === "taken" && actorRole !== "elder") {
    throw new DoseInvariantViolationError(
      `Only an explicit authenticated elder action can confirm medication ingestion ('taken'). Actor role '${actorRole}' cannot mark medication as taken.`
    );
  }

  // Invariant 2: A reminder is NEVER proof of ingestion
  if (fromStatus === "scheduled" && toStatus === "taken" && actorRole === "system") {
    throw new DoseInvariantViolationError(
      "Reminder notification is not evidence of medication ingestion. System cannot mark medication as taken."
    );
  }

  // Same status transition (idempotent no-op)
  if (fromStatus === toStatus) {
    return { valid: true, requiresCaregiverAlert: false };
  }

  // Define allowed transitions
  switch (fromStatus) {
    case "scheduled":
      if (toStatus === "reminded") {
        if (actorRole !== "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "Only system notifications can transition to 'reminded'." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      if (toStatus === "taken" || toStatus === "not_yet" || toStatus === "skipped") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "System cannot report user responses." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      if (toStatus === "unsure") {
        return { valid: true, requiresCaregiverAlert: true };
      }
      if (toStatus === "unconfirmed") {
        if (actorRole !== "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "'unconfirmed' is a system-generated state based on elapsed grace period." };
        }
        return { valid: true, requiresCaregiverAlert: true };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Direct transition from scheduled to ${toStatus} is not permitted.` };

    case "reminded":
      if (toStatus === "taken" || toStatus === "not_yet" || toStatus === "skipped") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "System cannot confirm patient responses." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      if (toStatus === "unsure") {
        return { valid: true, requiresCaregiverAlert: true };
      }
      if (toStatus === "unconfirmed") {
        if (actorRole !== "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "'unconfirmed' must be evaluated by system escalation runner." };
        }
        return { valid: true, requiresCaregiverAlert: true };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Illegal transition from reminded to ${toStatus}.` };

    case "not_yet":
      if (toStatus === "taken" || toStatus === "skipped") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "Not-yet doses cannot be marked taken/skipped by system." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      if (toStatus === "unsure") {
        return { valid: true, requiresCaregiverAlert: true };
      }
      if (toStatus === "unconfirmed") {
        return { valid: true, requiresCaregiverAlert: true };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Illegal transition from not_yet to ${toStatus}.` };

    case "unsure":
      // Unsure requires caregiver intervention or explicit clarification
      if (toStatus === "taken" || toStatus === "skipped" || toStatus === "not_yet") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "System cannot resolve an unsure dose." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      if (toStatus === "unconfirmed") {
        return { valid: true, requiresCaregiverAlert: true };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Illegal transition from unsure to ${toStatus}.` };

    case "unconfirmed":
      // Unconfirmed can be resolved retroactively by human actor
      if (toStatus === "taken" || toStatus === "skipped" || toStatus === "not_yet") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "System cannot retroactively confirm a dose." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Illegal transition from unconfirmed to ${toStatus}.` };

    case "skipped":
      if (toStatus === "taken") {
        if (actorRole === "system") {
          return { valid: false, requiresCaregiverAlert: false, reason: "System cannot correct skipped doses." };
        }
        return { valid: true, requiresCaregiverAlert: false };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: `Dose is already skipped.` };

    case "taken":
      // Taken is affirmative terminal state; only human override can alter it with notes
      if (toStatus === "skipped" && (actorRole === "caregiver" || actorRole === "elder")) {
        return { valid: true, requiresCaregiverAlert: true };
      }
      return { valid: false, requiresCaregiverAlert: false, reason: "Confirmed doses cannot be mutated without a verified human override." };

    default:
      return { valid: false, requiresCaregiverAlert: false, reason: `Unknown source status: ${fromStatus}` };
  }
}

/**
 * Executes a deterministic dose transition and calculates alert requirements.
 */
export function transitionDoseState(request: DoseStateTransitionRequest): DoseTransitionResult {
  const validation = validateDoseTransition(request);

  if (!validation.valid) {
    throw new InvalidDoseTransitionError(
      request.fromStatus,
      request.toStatus,
      validation.reason || "Transition not permitted"
    );
  }

  const now = request.timestamp || new Date().toISOString();

  return {
    success: true,
    previousStatus: request.fromStatus,
    currentStatus: request.toStatus,
    transitionedAt: now,
    actorId: request.actorId,
    actorRole: request.actorRole,
    requiresCaregiverAlert: validation.requiresCaregiverAlert,
    notes: request.notes,
  };
}

/**
 * Checks if a scheduled dose is past its grace period without confirmation.
 */
export function isDoseOverdue(
  scheduledFor: string,
  currentTime: Date = new Date(),
  gracePeriodMinutes: number = DEFAULT_GRACE_PERIOD_MINUTES
): boolean {
  const scheduledTime = new Date(scheduledFor).getTime();
  const graceWindowMs = gracePeriodMinutes * 60 * 1000;
  return currentTime.getTime() >= scheduledTime + graceWindowMs;
}

/**
 * Evaluates whether an active dose record should transition to 'unconfirmed'.
 */
export function evaluateDoseForUnconfirmed(
  dose: DoseRecord,
  currentTime: Date = new Date(),
  gracePeriodMinutes: number = DEFAULT_GRACE_PERIOD_MINUTES
): DoseStateTransitionRequest | null {
  // Only scheduled, reminded, or not_yet can transition to unconfirmed due to time elapsed
  if (
    dose.status !== "scheduled" &&
    dose.status !== "reminded" &&
    dose.status !== "not_yet"
  ) {
    return null;
  }

  if (isDoseOverdue(dose.scheduledFor, currentTime, gracePeriodMinutes)) {
    return {
      doseId: dose.id,
      fromStatus: dose.status,
      toStatus: "unconfirmed",
      actorId: "system",
      actorRole: "system",
      notes: `Dose grace period (${gracePeriodMinutes}m) expired without affirmative response.`,
      timestamp: currentTime.toISOString(),
    };
  }

  return null;
}

export interface AdherenceMetrics {
  totalExpectedDoses: number;
  takenDoses: number;
  unsureDoses: number;
  unconfirmedDoses: number;
  snoozedDoses: number;
  overdueUnescalatedDoses: number;
  skippedDoses: number;
  pendingOpenDoses: number;
  adherenceRate: number | null;
  adherenceRateDisplay: string;
}

/**
 * Calculates medication adherence rate with clinical rigor according to closed dose windows:
 * - Denominator: All scheduled dose occurrences whose dose windows have closed within the reporting period.
 * - Includes overdue doses whose window has elapsed even if their database status remains 'scheduled' or 'reminded'.
 * - Excludes future doses and doses whose reporting windows remain open.
 * - Numerator: Strictly explicit elder-reported 'taken' events.
 * - Zero-dose edge case: When eligible dose count is zero, returns null and 'N/A' (not 100%).
 * - Zero-taken edge case: When eligible doses exist but none taken, returns 0 and '0%'.
 */
export function calculateAdherenceMetrics(
  doses: Array<{
    id?: string;
    status: DoseStatus;
    scheduled_for?: string;
    scheduledFor?: string;
  }>,
  currentTime: Date = new Date(),
  gracePeriodMinutes: number = DEFAULT_GRACE_PERIOD_MINUTES
): AdherenceMetrics {
  let takenDoses = 0;
  let unsureDoses = 0;
  let unconfirmedDoses = 0;
  let snoozedDoses = 0;
  let overdueUnescalatedDoses = 0;
  let skippedDoses = 0;
  let pendingOpenDoses = 0;
  let totalExpectedDoses = 0;

  for (const dose of doses) {
    const scheduledTimeStr = dose.scheduled_for || dose.scheduledFor;
    const isOverdue = scheduledTimeStr
      ? isDoseOverdue(scheduledTimeStr, currentTime, gracePeriodMinutes)
      : true; // If no time provided, treat as closed

    switch (dose.status) {
      case "taken":
        takenDoses += 1;
        totalExpectedDoses += 1;
        break;

      case "skipped":
        skippedDoses += 1;
        totalExpectedDoses += 1;
        break;

      case "unconfirmed":
        unconfirmedDoses += 1;
        totalExpectedDoses += 1;
        break;

      case "unsure":
        unsureDoses += 1;
        totalExpectedDoses += 1;
        break;

      case "not_yet":
        snoozedDoses += 1;
        if (isOverdue) {
          // Grace period elapsed without confirmation
          totalExpectedDoses += 1;
        } else {
          // Grace window still open
          pendingOpenDoses += 1;
        }
        break;

      case "scheduled":
      case "reminded":
        if (isOverdue) {
          // Closed window overdue dose that has not yet been escalated
          overdueUnescalatedDoses += 1;
          totalExpectedDoses += 1;
        } else {
          // Future dose or dose currently inside open reminder window
          pendingOpenDoses += 1;
        }
        break;
    }
  }

  const adherenceRate =
    totalExpectedDoses > 0 ? Math.round((takenDoses / totalExpectedDoses) * 100) : null;
  const adherenceRateDisplay =
    adherenceRate !== null ? `${adherenceRate}%` : "N/A";

  return {
    totalExpectedDoses,
    takenDoses,
    unsureDoses,
    unconfirmedDoses,
    snoozedDoses,
    overdueUnescalatedDoses,
    skippedDoses,
    pendingOpenDoses,
    adherenceRate,
    adherenceRateDisplay,
  };
}
