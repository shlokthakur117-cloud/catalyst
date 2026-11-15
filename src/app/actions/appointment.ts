"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createAppointment,
  getAppointmentsForElder,
  updateAppointment,
  AppointmentRecord,
} from "@/services/appointment-service";
import { AppointmentCreateInput, AppointmentStatus } from "@/lib/validations/appointment";
import { revalidatePath } from "next/cache";

/**
 * Schedules a new medical appointment with companion notes.
 */
export async function createAppointmentAction(
  input: AppointmentCreateInput
): Promise<{ success: boolean; data?: AppointmentRecord; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actorId = user?.id || "00000000-0000-0000-0000-000000000009";

  const res = await createAppointment(supabase, input, {
    actorId,
    actorRole: "caregiver",
  });

  if (res.success) {
    revalidatePath("/caregiver");
    revalidatePath("/elder");
  }

  return res;
}

/**
 * Retrieves upcoming and completed appointments for an elder.
 */
export async function fetchAppointmentsAction(
  elderId: string,
  options?: { status?: AppointmentStatus }
): Promise<{ success: boolean; data: AppointmentRecord[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  return getAppointmentsForElder(supabase, elderId, options);
}

/**
 * Updates an appointment's status (e.g. marking it 'completed' or 'cancelled').
 */
export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actorId = user?.id || "00000000-0000-0000-0000-000000000009";

  const res = await updateAppointment(
    supabase,
    appointmentId,
    { status },
    { actorId, actorRole: "caregiver" }
  );

  if (res.success) {
    revalidatePath("/caregiver");
    revalidatePath("/elder");
  }

  return { success: res.success, error: res.error };
}
