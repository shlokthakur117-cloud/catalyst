"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DoseStatus, DoseActorRole } from "@/types/dose";
import {
  recordDoseTransition,
  getDosesForElderDate,
  DoseWithMedication,
} from "@/services/dose-service";
import { revalidatePath } from "next/cache";

export interface UpdateDoseResult {
  success: boolean;
  updatedDose?: DoseWithMedication;
  error?: string;
}

/**
 * Server action to update a dose status from the Elder Touch UI or Caregiver Dashboard.
 */
export async function updateDoseStatusAction(
  doseId: string,
  toStatus: DoseStatus,
  notes?: string
): Promise<UpdateDoseResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is authenticated, determine role; fallback to elder on tablet interface
  let actorId: string = user?.id || "";
  let actorRole: DoseActorRole = "elder";

  if (!actorId) {
    // For single-touch elder kiosk / tablet mode: fetch elderId from dose itself
    const { data: dose } = await (supabase as any)
      .from("dose_logs")
      .select("elder_id")
      .eq("id", doseId)
      .single();

    actorId = dose?.elder_id || "00000000-0000-0000-0000-000000000001";
    actorRole = "elder";
  } else {
    // Query profile role
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("id", actorId)
      .single();

    if (profile?.role === "caregiver") {
      actorRole = "caregiver";
    }
  }

  const res = await recordDoseTransition(supabase, {
    doseId,
    toStatus,
    actorId,
    actorRole,
    notes,
  });

  if (res.success) {
    revalidatePath("/elder");
    revalidatePath("/caregiver");
  }

  return {
    success: res.success,
    updatedDose: res.updatedDose,
    error: res.error,
  };
}

/**
 * Server action to fetch today's doses for an elder with automated recurring schedule hydration.
 */
export async function fetchTodayDosesAction(
  elderId: string,
  dateStr?: string
): Promise<{ success: boolean; doses: DoseWithMedication[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // If no date provided, use today in YYYY-MM-DD
  const targetDate = dateStr || new Date().toISOString().split("T")[0];

  try {
    const doses = await getDosesForElderDate(supabase, elderId, targetDate, true);
    return { success: true, doses };
  } catch (err: any) {
    return { success: false, doses: [], error: err.message };
  }
}

/**
 * Resolves current elder profile or active elder for dashboard views.
 */
export async function getActiveElderAction(): Promise<{
  id: string;
  fullName: string;
  emergencyContactPhone?: string | null;
  emergencyNotes?: string | null;
} | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if user is elder
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, role, emergency_contact_phone, emergency_notes")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.role === "elder") {
      return {
        id: profile.id,
        fullName: profile.full_name,
        emergencyContactPhone: profile.emergency_contact_phone,
        emergencyNotes: profile.emergency_notes,
      };
    }

    // If user is caregiver, get first linked elder
    if (profile && profile.role === "caregiver") {
      const { data: relationship } = await (supabase as any)
        .from("care_relationships")
        .select("elder_id, profiles!elder_id(id, full_name, emergency_contact_phone, emergency_notes)")
        .eq("caregiver_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (relationship?.profiles) {
        const elder = relationship.profiles as any;
        return {
          id: elder.id,
          fullName: elder.full_name,
          emergencyContactPhone: elder.emergency_contact_phone,
          emergencyNotes: elder.emergency_notes,
        };
      }
    }
  }

  // Fallback: query first elder in database or return mock elder for seamless demo
  const { data: fallbackElder } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, emergency_contact_phone, emergency_notes")
    .eq("role", "elder")
    .limit(1)
    .maybeSingle();

  if (fallbackElder) {
    return {
      id: fallbackElder.id,
      fullName: fallbackElder.full_name,
      emergencyContactPhone: fallbackElder.emergency_contact_phone,
      emergencyNotes: fallbackElder.emergency_notes,
    };
  }

  return {
    id: "00000000-0000-0000-0000-000000000001",
    fullName: "Eleanor Vance (Demo Elder)",
    emergencyContactPhone: "+1 (555) 019-2834",
    emergencyNotes: "Mild penicilin allergy. Lives with cat.",
  };
}
