import { SupabaseClient } from "@supabase/supabase-js";
import { DoseStatus, DoseActorRole, DoseTransitionResult } from "@/types/dose";
import {
  transitionDoseState,
  isDoseOverdue,
  DEFAULT_GRACE_PERIOD_MINUTES,
  InvalidDoseTransitionError,
  DoseInvariantViolationError,
} from "./dose-engine";
import { persistCaregiverAlert } from "./alert-service";
import { emitAuditLog } from "./audit-service";
import { getSchedulesForElder, generateExpectedDoseSlots } from "./schedule-service";
import { AlertType, AlertUrgency } from "@/types/database";

export interface DoseWithMedication {
  id: string;
  schedule_id: string | null;
  medication_id: string;
  elder_id: string;
  scheduled_for: string;
  status: DoseStatus;
  reminded_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  actor_role: DoseActorRole | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  medications?: {
    name: string;
    strength: string;
    instructions: string;
  } | null;
}

export interface TransitionDoseParams {
  doseId: string;
  toStatus: DoseStatus;
  actorId: string;
  actorRole: DoseActorRole;
  notes?: string;
  timestamp?: string;
}

/**
 * Transitions a dose record to a new status with optimistic concurrency protection,
 * automated caregiver alert creation for unresolved states, and immutable audit logging.
 */
export async function recordDoseTransition(
  client: SupabaseClient<any, any, any>,
  params: TransitionDoseParams
): Promise<{
  success: boolean;
  result?: DoseTransitionResult;
  updatedDose?: DoseWithMedication;
  error?: string;
}> {
  const { doseId, toStatus, actorId, actorRole, notes, timestamp } = params;

  // 1. Fetch current dose record
  const { data: existing, error: fetchError } = await client
    .from("dose_logs")
    .select("*, medications(name, strength, instructions)")
    .eq("id", doseId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Dose record not found." };
  }

  // Idempotent check
  if (existing.status === toStatus) {
    return {
      success: true,
      updatedDose: existing as DoseWithMedication,
      result: {
        success: true,
        previousStatus: existing.status as DoseStatus,
        currentStatus: toStatus,
        transitionedAt: existing.updated_at,
        actorId,
        actorRole,
        requiresCaregiverAlert: false,
        notes: existing.notes || undefined,
      },
    };
  }

  // 2. Pure state machine validation
  let transitionResult: DoseTransitionResult;
  try {
    transitionResult = transitionDoseState({
      doseId,
      fromStatus: existing.status as DoseStatus,
      toStatus,
      actorId,
      actorRole,
      notes,
      timestamp,
    });
  } catch (err: any) {
    if (err instanceof InvalidDoseTransitionError || err instanceof DoseInvariantViolationError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  // 3. Prepare optimistic update payload
  const now = timestamp || new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status: toStatus,
    actor_role: actorRole,
    notes: notes !== undefined ? notes : existing.notes,
    updated_at: now,
  };

  if (toStatus === "taken") {
    updatePayload.confirmed_at = now;
    updatePayload.confirmed_by = actorId;
  } else if (toStatus === "reminded") {
    updatePayload.reminded_at = now;
  } else if (toStatus === "unsure" || toStatus === "not_yet" || toStatus === "skipped") {
    updatePayload.confirmed_by = actorId;
  }

  // 4. Atomic conditional update guarding against race conditions
  const { data: updatedDose, error: updateError } = await client
    .from("dose_logs")
    .update(updatePayload)
    .eq("id", doseId)
    .eq("status", existing.status) // Optimistic check
    .select("*, medications(name, strength, instructions)")
    .single();

  if (updateError || !updatedDose) {
    // Check if another concurrent actor changed it
    const { data: currentCheck } = await client
      .from("dose_logs")
      .select("status")
      .eq("id", doseId)
      .single();

    if (currentCheck && currentCheck.status !== existing.status) {
      return {
        success: false,
        error: `Dose status was concurrently changed to '${currentCheck.status}' by another user.`,
      };
    }

    return {
      success: false,
      error: updateError?.message || "Failed to update dose status.",
    };
  }

  // 5. Trigger caregiver alert if required by clinical state model
  if (transitionResult.requiresCaregiverAlert) {
    const alertType: AlertType = toStatus === "unsure" ? "unsure_dose" : "unconfirmed_dose";
    const urgency: AlertUrgency = toStatus === "unsure" ? "high" : "critical";

    await persistCaregiverAlert(client, {
      elderId: existing.elder_id,
      doseLogId: doseId,
      alertType,
      urgency,
      notes: notes || `Dose marked as ${toStatus}. Caregiver review requested.`,
      actorId,
      actorRole,
    });
  }

  // 6. Immutable append-only audit trail
  await emitAuditLog(client, {
    elderId: existing.elder_id,
    actorId,
    actorRole,
    action: `dose.status_${toStatus}`,
    entityType: "dose_log",
    entityId: doseId,
    oldValues: existing,
    newValues: updatedDose,
  });

  return {
    success: true,
    result: transitionResult,
    updatedDose: updatedDose as DoseWithMedication,
  };
}

/**
 * Hydrates expected dose slots from active recurring schedules into the dose_logs table
 * for a specific date (YYYY-MM-DD), ensuring slots exist without duplicating existing records.
 */
export async function hydrateExpectedDosesForElder(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  dateStr: string
): Promise<DoseWithMedication[]> {
  const { data: schedules } = await getSchedulesForElder(client, elderId, { activeOnly: true });
  if (!schedules || schedules.length === 0) {
    return [];
  }

  const createdDoses: DoseWithMedication[] = [];

  for (const schedule of schedules) {
    const slots = generateExpectedDoseSlots(schedule, dateStr, dateStr);

    for (const slot of slots) {
      // Check if slot already exists in dose_logs
      const { data: existing } = await client
        .from("dose_logs")
        .select("id")
        .eq("schedule_id", schedule.id)
        .eq("scheduled_for", slot.scheduledFor)
        .maybeSingle();

      if (!existing) {
        const { data: inserted, error } = await client
          .from("dose_logs")
          .insert({
            schedule_id: schedule.id,
            medication_id: schedule.medication_id,
            elder_id: elderId,
            scheduled_for: slot.scheduledFor,
            status: "scheduled",
          })
          .select("*, medications(name, strength, instructions)")
          .single();

        if (!error && inserted) {
          createdDoses.push(inserted as DoseWithMedication);
        }
      }
    }
  }

  return createdDoses;
}

/**
 * Retrieves all dose records for an elder on a specific date (YYYY-MM-DD).
 * If no doses exist for that date, automatically provisions expected doses from active schedules.
 */
export async function getDosesForElderDate(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  dateStr: string,
  autoHydrate: boolean = true
): Promise<DoseWithMedication[]> {
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const { data: existingDoses, error } = await client
    .from("dose_logs")
    .select("*, medications(name, strength, instructions)")
    .eq("elder_id", elderId)
    .gte("scheduled_for", startOfDay)
    .lte("scheduled_for", endOfDay)
    .order("scheduled_for", { ascending: true });

  if (error) {
    console.error("Error querying doses for elder:", error);
    return [];
  }

  if ((!existingDoses || existingDoses.length === 0) && autoHydrate) {
    await hydrateExpectedDosesForElder(client, elderId, dateStr);

    // Re-fetch after hydration
    const { data: hydratedDoses } = await client
      .from("dose_logs")
      .select("*, medications(name, strength, instructions)")
      .eq("elder_id", elderId)
      .gte("scheduled_for", startOfDay)
      .lte("scheduled_for", endOfDay)
      .order("scheduled_for", { ascending: true });

    return (hydratedDoses as DoseWithMedication[]) || [];
  }

  return (existingDoses as DoseWithMedication[]) || [];
}

/**
 * Scans all open doses (scheduled, reminded, not_yet) for an elder and transitions
 * any doses past the grace period into 'unconfirmed' with high-priority caregiver alerts.
 */
export async function escalateOverdueDosesForElder(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  currentTime: Date = new Date(),
  gracePeriodMinutes: number = DEFAULT_GRACE_PERIOD_MINUTES
): Promise<{ evaluated: number; escalated: number }> {
  const { data: openDoses } = await client
    .from("dose_logs")
    .select("id, status, scheduled_for, elder_id")
    .eq("elder_id", elderId)
    .in("status", ["scheduled", "reminded", "not_yet"]);

  if (!openDoses || openDoses.length === 0) {
    return { evaluated: 0, escalated: 0 };
  }

  let escalated = 0;
  for (const dose of openDoses) {
    if (isDoseOverdue(dose.scheduled_for, currentTime, gracePeriodMinutes)) {
      const res = await recordDoseTransition(client, {
        doseId: dose.id,
        toStatus: "unconfirmed",
        actorId: "00000000-0000-0000-0000-000000000000",
        actorRole: "system",
        notes: `Dose grace period (${gracePeriodMinutes}m) expired without affirmative response.`,
        timestamp: currentTime.toISOString(),
      });

      if (res.success) {
        escalated++;
      }
    }
  }

  return { evaluated: openDoses.length, escalated };
}
