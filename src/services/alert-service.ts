import { SupabaseClient } from "@supabase/supabase-js";
import { Database, AlertType, AlertUrgency, AlertStatus } from "@/types/database";
import { emitAuditLog } from "@/services/audit-service";
import { verifyCaregiverElderAuthorization } from "@/services/relationship-service";

export interface CreateAlertParams {
  elderId: string;
  doseLogId?: string | null;
  alertType: AlertType;
  urgency?: AlertUrgency;
  notes?: string;
  actorId?: string;
  actorRole?: "elder" | "caregiver" | "system";
}

export interface CaregiverAlertRecord {
  id: string;
  elderId: string;
  doseLogId: string | null;
  alertType: AlertType;
  urgency: AlertUrgency;
  status: AlertStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

/**
 * Persists a caregiver alert with strict duplicate prevention.
 * If an active (open or claimed) alert already exists for this specific dose_log_id,
 * returns the existing alert to avoid duplicate notifications and split caregiver attention.
 */
export async function persistCaregiverAlert(
  supabase: SupabaseClient<any, any, any>,
  params: CreateAlertParams
): Promise<{ alert: CaregiverAlertRecord; isDuplicate: boolean }> {
  // Duplicate check for dose-related alerts
  if (params.doseLogId) {
    const { data: existingAlert, error: checkError } = await supabase
      .from("caregiver_alerts")
      .select("*")
      .eq("elder_id", params.elderId)
      .eq("dose_log_id", params.doseLogId)
      .in("status", ["open", "claimed"])
      .maybeSingle();

    if (!checkError && existingAlert) {
      return {
        alert: {
          id: existingAlert.id,
          elderId: existingAlert.elder_id,
          doseLogId: existingAlert.dose_log_id,
          alertType: existingAlert.alert_type,
          urgency: existingAlert.urgency,
          status: existingAlert.status,
          claimedBy: existingAlert.claimed_by,
          claimedAt: existingAlert.claimed_at,
          resolvedAt: existingAlert.resolved_at,
          resolutionNotes: existingAlert.resolution_notes,
          createdAt: existingAlert.created_at,
        },
        isDuplicate: true,
      };
    }
  }

  // Insert fresh alert
  const { data: inserted, error: insertError } = await supabase
    .from("caregiver_alerts")
    .insert({
      elder_id: params.elderId,
      dose_log_id: params.doseLogId || null,
      alert_type: params.alertType,
      urgency: params.urgency || "high",
      status: "open",
      resolution_notes: params.notes || null,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to persist caregiver alert: ${insertError?.message || "Unknown error"}`);
  }

  // Emit immutable audit trail
  await emitAuditLog(supabase, {
    elderId: params.elderId,
    actorId: params.actorId || null,
    actorRole: params.actorRole || "system",
    action: "create_alert",
    entityType: "caregiver_alert",
    entityId: inserted.id,
    newValues: {
      alertType: params.alertType,
      urgency: params.urgency || "high",
      doseLogId: params.doseLogId,
      status: "open",
    },
  });

  return {
    alert: {
      id: inserted.id,
      elderId: inserted.elder_id,
      doseLogId: inserted.dose_log_id,
      alertType: inserted.alert_type,
      urgency: inserted.urgency,
      status: inserted.status,
      claimedBy: inserted.claimed_by,
      claimedAt: inserted.claimed_at,
      resolvedAt: inserted.resolved_at,
      resolutionNotes: inserted.resolution_notes,
      createdAt: inserted.created_at,
    },
    isDuplicate: false,
  };
}

/**
 * Claims responsibility for an active alert.
 */
export async function claimCaregiverAlert(
  supabase: SupabaseClient<any, any, any>,
  alertId: string,
  caregiverId: string
): Promise<CaregiverAlertRecord> {
  // Fetch alert first to verify authorization against elder
  const { data: alert, error: fetchError } = await supabase
    .from("caregiver_alerts")
    .select("*")
    .eq("id", alertId)
    .single();

  if (fetchError || !alert) {
    throw new Error("Alert not found.");
  }

  // Server-side authorization check
  const isAuthorized = await verifyCaregiverElderAuthorization(supabase, caregiverId, alert.elder_id);
  if (!isAuthorized) {
    throw new Error("Unauthorized: Caregiver is not authorized to claim alerts for this elder.");
  }

  if (alert.status === "resolved") {
    throw new Error("Cannot claim an already resolved alert.");
  }

  const now = new Date().toISOString();

  // Atomic concurrency guard: condition on status = 'open'
  const { data: updated, error: updateError } = await supabase
    .from("caregiver_alerts")
    .update({
      status: "claimed",
      claimed_by: caregiverId,
      claimed_at: now,
    })
    .eq("id", alertId)
    .eq("status", "open")
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    throw new Error("Conflict: Alert is no longer open or was already claimed by another caregiver.");
  }

  await emitAuditLog(supabase, {
    elderId: alert.elder_id,
    actorId: caregiverId,
    actorRole: "caregiver",
    action: "claim_alert",
    entityType: "caregiver_alert",
    entityId: alertId,
    oldValues: { status: alert.status, claimed_by: alert.claimed_by },
    newValues: { status: "claimed", claimed_by: caregiverId, claimed_at: now },
  });

  return {
    id: updated.id,
    elderId: updated.elder_id,
    doseLogId: updated.dose_log_id,
    alertType: updated.alert_type,
    urgency: updated.urgency,
    status: updated.status,
    claimedBy: updated.claimed_by,
    claimedAt: updated.claimed_at,
    resolvedAt: updated.resolved_at,
    resolutionNotes: updated.resolution_notes,
    createdAt: updated.created_at,
  };
}

/**
 * Resolves a claimed or open alert with mandatory resolution documentation.
 */
export async function resolveCaregiverAlert(
  supabase: SupabaseClient<any, any, any>,
  alertId: string,
  caregiverId: string,
  resolutionNotes: string
): Promise<CaregiverAlertRecord> {
  const { data: alert, error: fetchError } = await supabase
    .from("caregiver_alerts")
    .select("*")
    .eq("id", alertId)
    .single();

  if (fetchError || !alert) {
    throw new Error("Alert not found.");
  }

  const isAuthorized = await verifyCaregiverElderAuthorization(supabase, caregiverId, alert.elder_id);
  if (!isAuthorized) {
    throw new Error("Unauthorized: Caregiver is not authorized to resolve alerts for this elder.");
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("caregiver_alerts")
    .update({
      status: "resolved",
      resolved_at: now,
      resolution_notes: resolutionNotes,
    })
    .eq("id", alertId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to resolve alert: ${updateError?.message}`);
  }

  await emitAuditLog(supabase, {
    elderId: alert.elder_id,
    actorId: caregiverId,
    actorRole: "caregiver",
    action: "resolve_alert",
    entityType: "caregiver_alert",
    entityId: alertId,
    oldValues: { status: alert.status },
    newValues: { status: "resolved", resolved_at: now, resolutionNotes },
  });

  return {
    id: updated.id,
    elderId: updated.elder_id,
    doseLogId: updated.dose_log_id,
    alertType: updated.alert_type,
    urgency: updated.urgency,
    status: updated.status,
    claimedBy: updated.claimed_by,
    claimedAt: updated.claimed_at,
    resolvedAt: updated.resolved_at,
    resolutionNotes: updated.resolution_notes,
    createdAt: updated.created_at,
  };
}
