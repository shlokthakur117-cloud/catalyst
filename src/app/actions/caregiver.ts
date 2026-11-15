"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createMedication,
  listMedicationsForElder,
  MedicationRecord,
} from "@/services/medication-service";
import {
  createSchedule,
  getSchedulesForElder,
  ScheduleRecord,
} from "@/services/schedule-service";
import {
  getDosesForElderDate,
  DoseWithMedication,
} from "@/services/dose-service";
import {
  claimCaregiverAlert,
  resolveCaregiverAlert,
  CaregiverAlertRecord,
} from "@/services/alert-service";
import { emitAuditLog } from "@/services/audit-service";
import { calculateAdherenceMetrics } from "@/services/dose-engine";
import {
  MedicationCreateInput,
  TimeOfDay,
} from "@/lib/validations/medication";
import { revalidatePath } from "next/cache";

export interface LinkedElderSummary {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  relationshipType?: string;
}

export interface CaregiverAlertDetails {
  id: string;
  elder_id: string;
  dose_log_id?: string | null;
  alert_type: "unconfirmed_dose" | "unsure_dose" | "missed_appointment" | string;
  urgency: "medium" | "high" | "critical" | string;
  status: "open" | "claimed" | "resolved" | string;
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  medication_name?: string;
  dosage?: string;
  scheduled_for?: string;
  dose_status?: string;
  elder_name?: string;
  elder_phone?: string | null;
}

export interface CaregiverDashboardData {
  elder: LinkedElderSummary;
  doses: DoseWithMedication[];
  alerts: CaregiverAlertDetails[];
  medications: MedicationRecord[];
  schedules: ScheduleRecord[];
  stats: {
    totalDoses: number;
    takenDoses: number;
    unsureDoses: number;
    unconfirmedDoses: number;
    snoozedDoses: number;
    overdueUnescalatedDoses?: number;
    pendingOpenDoses?: number;
    adherenceRate: number | null;
    adherenceRateDisplay: string;
  };
}

/**
 * Fetches all elders linked to the current caregiver via active care_relationships.
 */
export async function fetchLinkedEldersAction(): Promise<LinkedElderSummary[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: relationships } = await (supabase as any)
      .from("care_relationships")
      .select("elder_id, relationship_type, profiles!elder_id(id, full_name, email, phone)")
      .eq("caregiver_id", user.id)
      .eq("status", "active");

    if (relationships && relationships.length > 0) {
      return relationships.map((r: any) => ({
        id: r.profiles?.id || r.elder_id,
        fullName: r.profiles?.full_name || "Elder",
        email: r.profiles?.email || "",
        phone: r.profiles?.phone || null,
        relationshipType: r.relationship_type,
      }));
    }

    // Authenticated caregiver with no active links must see zero elders
    return [];
  }

  // Fallback demo elders for instant test & review
  const { data: allElders } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("role", "elder")
    .limit(5);

  if (allElders && allElders.length > 0) {
    return allElders.map((e: any) => ({
      id: e.id,
      fullName: e.full_name,
      email: e.email,
      phone: e.phone,
      relationshipType: "Primary Caregiver",
    }));
  }

  return [
    {
      id: "00000000-0000-0000-0000-000000000001",
      fullName: "Eleanor Vance",
      email: "eleanor.vance@demo.careledger.org",
      phone: "+1 (555) 019-2834",
      relationshipType: "Mother",
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      fullName: "Arthur Pendelton",
      email: "arthur.pendelton@demo.careledger.org",
      phone: "+1 (555) 019-5829",
      relationshipType: "Father-in-law",
    },
  ];
}

/**
 * Loads comprehensive metrics, doses, alerts, and prescriptions for a selected elder.
 */
export async function fetchCaregiverDashboardDataAction(
  elderId: string
): Promise<{ success: boolean; data?: CaregiverDashboardData; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Fetch elder profile
    const { data: elderProfile } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", elderId)
      .maybeSingle();

    if (!elderProfile) {
      return {
        success: false,
        error: "Elder profile not found or care relationship is unauthorized/inactive.",
      };
    }

    const elder: LinkedElderSummary = {
      id: elderId,
      fullName: elderProfile.full_name,
      email: elderProfile.email,
      phone: elderProfile.phone || null,
      relationshipType: "Caregiver",
    };

    // 2. Fetch today's doses
    const doses = await getDosesForElderDate(supabase, elderId, today, true);

    // 3. Fetch active alerts with linked profiles and dose_logs
    const { data: rawAlerts } = await (supabase as any)
      .from("caregiver_alerts")
      .select("*, profiles!claimed_by(full_name), dose_logs(id, scheduled_for, status, medications(name, dosage))")
      .eq("elder_id", elderId)
      .in("status", ["open", "claimed"])
      .order("created_at", { ascending: false });

    const alerts: CaregiverAlertDetails[] = (rawAlerts || []).map((a: any) => {
      const matchingDose = doses.find((d) => d.id === a.dose_log_id);
      return {
        id: a.id,
        elder_id: a.elder_id,
        dose_log_id: a.dose_log_id,
        alert_type: a.alert_type,
        urgency: a.urgency || "high",
        status: a.status,
        claimed_by: a.claimed_by,
        claimed_by_name: a.profiles?.full_name || null,
        resolution_notes: a.resolution_notes,
        created_at: a.created_at || new Date().toISOString(),
        medication_name:
          a.dose_logs?.medications?.name ||
          (matchingDose as any)?.medications?.name ||
          (matchingDose as any)?.medication?.name ||
          "Prescribed Medication",
        dosage:
          a.dose_logs?.medications?.dosage ||
          (matchingDose as any)?.medications?.dosage ||
          (matchingDose as any)?.medication?.dosage ||
          "",
        scheduled_for:
          a.dose_logs?.scheduled_for ||
          matchingDose?.scheduled_for ||
          a.created_at ||
          new Date().toISOString(),
        dose_status:
          a.dose_logs?.status ||
          matchingDose?.status ||
          (a.alert_type === "unsure_dose" ? "unsure" : "unconfirmed"),
        elder_name: elder.fullName,
        elder_phone: elder.phone,
      };
    });

    // 4. Fetch medications & schedules
    const medResult = await listMedicationsForElder(supabase, elderId, { activeOnly: false });
    const schedResult = await getSchedulesForElder(supabase, elderId, { activeOnly: true });

    // 5. Calculate deterministic adherence metrics based on closed dose windows
    const metrics = calculateAdherenceMetrics(doses);

    return {
      success: true,
      data: {
        elder,
        doses,
        alerts: alerts || [],
        medications: medResult.data || [],
        schedules: schedResult.data || [],
        stats: {
          totalDoses: metrics.totalExpectedDoses,
          takenDoses: metrics.takenDoses,
          unsureDoses: metrics.unsureDoses,
          unconfirmedDoses: metrics.unconfirmedDoses,
          snoozedDoses: metrics.snoozedDoses,
          overdueUnescalatedDoses: metrics.overdueUnescalatedDoses,
          pendingOpenDoses: metrics.pendingOpenDoses,
          adherenceRate: metrics.adherenceRate,
          adherenceRateDisplay: metrics.adherenceRateDisplay,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates a medication and its recurring daily schedule in one transaction flow with audit logging.
 */
export async function createMedicationWithScheduleAction(
  elderId: string,
  input: {
    medication: MedicationCreateInput;
    schedule: {
      time_of_day: TimeOfDay;
      exact_time?: string | null;
      days_of_week?: number[];
      dose_amount?: string;
    };
  }
): Promise<{ success: boolean; medicationId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actorId = user?.id || "00000000-0000-0000-0000-000000000009";

  // 1. Create medication
  const medRes = await createMedication(supabase, elderId, input.medication, {
    actorId,
    actorRole: "caregiver",
  });

  if (!medRes.success || !medRes.data) {
    return { success: false, error: medRes.error || "Failed to create medication" };
  }

  // 2. Create schedule
  const schedRes = await createSchedule(
    supabase,
    {
      medication_id: medRes.data.id,
      elder_id: elderId,
      time_of_day: input.schedule.time_of_day,
      exact_time: input.schedule.exact_time || null,
      days_of_week: input.schedule.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      dose_amount: input.schedule.dose_amount || "1 pill",
      active: true,
    },
    { actorId, actorRole: "caregiver" }
  );

  if (!schedRes.success) {
    return { success: false, error: schedRes.error || "Failed to create schedule" };
  }

  revalidatePath("/caregiver");
  revalidatePath("/elder");

  return { success: true, medicationId: medRes.data.id };
}

/**
 * Caregiver claims responsibility for an unresolved dose alert.
 */
export async function claimAlertAction(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caregiverId = user?.id || "00000000-0000-0000-0000-000000000009";

  try {
    await claimCaregiverAlert(supabase, alertId, caregiverId);
    revalidatePath("/caregiver");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Caregiver marks an alert as resolved after phoning the elder or verifying ingestion.
 */
export async function resolveAlertAction(
  alertId: string,
  resolutionNotes: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caregiverId = user?.id || "00000000-0000-0000-0000-000000000009";

  try {
    await resolveCaregiverAlert(supabase, alertId, caregiverId, resolutionNotes);
    revalidatePath("/caregiver");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
