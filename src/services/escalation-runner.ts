import { SupabaseClient } from "@supabase/supabase-js";
import { recordDoseTransition } from "./dose-service";
import { isDoseOverdue, DEFAULT_GRACE_PERIOD_MINUTES } from "./dose-engine";
import { sendCaregiverAlertEmail } from "./notification-service";

export interface EscalationCheckOptions {
  elderId?: string;
  currentTime?: Date;
  gracePeriodMinutes?: number;
}

export interface EscalationCheckSummary {
  evaluated: number;
  escalated: number;
  notificationsSent: number;
}

/**
 * Background escalation runner that inspects open dose records, deterministically
 * transitions those past the grace period to 'unconfirmed', and dispatches
 * critical alert emails to linked caregivers.
 */
export async function runEscalationCheck(
  supabase: SupabaseClient<any, any, any>,
  options: EscalationCheckOptions = {}
): Promise<EscalationCheckSummary> {
  const currentTime = options.currentTime || new Date();
  const gracePeriodMinutes = options.gracePeriodMinutes || DEFAULT_GRACE_PERIOD_MINUTES;

  let query = supabase
    .from("dose_logs")
    .select("id, status, scheduled_for, elder_id, medications(name, strength), profiles!elder_id(full_name)")
    .in("status", ["scheduled", "reminded", "not_yet"]);

  if (options.elderId) {
    query = query.eq("elder_id", options.elderId);
  }

  const { data: openDoses, error } = await query;
  if (error || !openDoses) {
    console.error("Failed to query open doses for escalation:", error);
    return { evaluated: 0, escalated: 0, notificationsSent: 0 };
  }

  let escalated = 0;
  let notificationsSent = 0;

  for (const dose of openDoses) {
    if (isDoseOverdue(dose.scheduled_for, currentTime, gracePeriodMinutes)) {
      const res = await recordDoseTransition(supabase, {
        doseId: dose.id,
        toStatus: "unconfirmed",
        actorId: "00000000-0000-0000-0000-000000000000",
        actorRole: "system",
        notes: `Dose grace period (${gracePeriodMinutes}m) expired without affirmative response.`,
        timestamp: currentTime.toISOString(),
      });

      if (res.success) {
        escalated++;

        // Query active linked caregivers for this elder
        const { data: caregivers } = await supabase
          .from("care_relationships")
          .select("caregiver_id, profiles!caregiver_id(full_name, email)")
          .eq("elder_id", dose.elder_id)
          .eq("status", "active");

        const medName = (dose.medications as any)?.name || "Prescription";
        const strength = (dose.medications as any)?.strength || "";
        const elderName = (dose.profiles as any)?.full_name || "Elder";

        if (caregivers && caregivers.length > 0) {
          for (const rel of caregivers) {
            const caregiverProfile = (rel as any).profiles;
            if (caregiverProfile?.email) {
              const res = await sendCaregiverAlertEmail({
                caregiverName: caregiverProfile.full_name || "Caregiver",
                caregiverEmail: caregiverProfile.email,
                elderName,
                medicationName: medName,
                strength,
                scheduledFor: dose.scheduled_for,
                alertType: "unconfirmed_dose",
                urgency: "critical",
              });
              if (res.success) {
                notificationsSent++;
              } else {
                console.warn(`Failed to dispatch alert email to ${caregiverProfile.email}: ${res.error}`);
              }
            }
          }
        }
      }
    }
  }

  return {
    evaluated: openDoses.length,
    escalated,
    notificationsSent,
  };
}

/**
 * Triggers immediate email notifications to linked caregivers when an elder reports 'unsure'.
 */
export async function triggerImmediateUnsureEscalation(
  supabase: SupabaseClient<any, any, any>,
  doseId: string,
  elderId: string,
  reportedNotes?: string | null
): Promise<{ success: boolean; notificationsSent: number }> {
  const { data: dose } = await supabase
    .from("dose_logs")
    .select("scheduled_for, medications(name, strength), profiles!elder_id(full_name)")
    .eq("id", doseId)
    .single();

  const { data: caregivers } = await supabase
    .from("care_relationships")
    .select("profiles!caregiver_id(full_name, email)")
    .eq("elder_id", elderId)
    .eq("status", "active");

  let notificationsSent = 0;
  const medName = (dose?.medications as any)?.name || "Medication";
  const strength = (dose?.medications as any)?.strength || "";
  const elderName = (dose?.profiles as any)?.full_name || "Elder";

  if (caregivers && caregivers.length > 0) {
    for (const rel of caregivers) {
      const caregiverProfile = (rel as any).profiles;
      if (caregiverProfile?.email) {
        const res = await sendCaregiverAlertEmail({
          caregiverName: caregiverProfile.full_name || "Caregiver",
          caregiverEmail: caregiverProfile.email,
          elderName,
          medicationName: medName,
          strength,
          scheduledFor: dose?.scheduled_for || new Date().toISOString(),
          alertType: "unsure_dose",
          urgency: "high",
          reportedNotes,
        });
        if (res.success) {
          notificationsSent++;
        } else {
          console.warn(`Failed to dispatch unsure alert email to ${caregiverProfile.email}: ${res.error}`);
        }
      }
    }
  }

  return { success: true, notificationsSent };
}
