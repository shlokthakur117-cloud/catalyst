import { SupabaseClient } from "@supabase/supabase-js";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  AppointmentStatus,
} from "@/lib/validations/appointment";
import { emitAuditLog } from "./audit-service";

export interface AppointmentRecord {
  id: string;
  elder_id: string;
  title: string;
  doctor_name: string;
  clinic_address: string | null;
  scheduled_at: string;
  companion_notes: string | null;
  status: AppointmentStatus;
  created_at: string;
}

/**
 * Creates an appointment record for an elder and audits the event.
 */
export async function createAppointment(
  client: SupabaseClient<any, any, any>,
  input: AppointmentCreateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: AppointmentRecord; error?: string }> {
  const validated = appointmentCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data, error } = await client
    .from("appointments")
    .insert({
      elder_id: validated.data.elder_id,
      title: validated.data.title,
      doctor_name: validated.data.doctor_name,
      clinic_address: validated.data.clinic_address || null,
      scheduled_at: new Date(validated.data.scheduled_at).toISOString(),
      companion_notes: validated.data.companion_notes || null,
      status: validated.data.status,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create appointment" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId: validated.data.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "appointment.created",
      entityType: "appointment",
      entityId: data.id,
      newValues: data,
    });
  }

  return { success: true, data: data as AppointmentRecord };
}

/**
 * Retrieves appointments for an elder ordered chronologically.
 */
export async function getAppointmentsForElder(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  options: { status?: AppointmentStatus } = {}
): Promise<{ success: boolean; data: AppointmentRecord[]; error?: string }> {
  let query = client
    .from("appointments")
    .select("*")
    .eq("elder_id", elderId)
    .order("scheduled_at", { ascending: true });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, data: [], error: error.message };
  }

  return { success: true, data: (data as AppointmentRecord[]) || [] };
}

/**
 * Updates an appointment (e.g. status to 'completed' or updating companion notes).
 */
export async function updateAppointment(
  client: SupabaseClient<any, any, any>,
  appointmentId: string,
  input: AppointmentUpdateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: AppointmentRecord; error?: string }> {
  const validated = appointmentUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data: existing } = await client
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  const payload: Record<string, any> = { ...validated.data };
  if (payload.scheduled_at) {
    payload.scheduled_at = new Date(payload.scheduled_at).toISOString();
  }

  const { data, error } = await client
    .from("appointments")
    .update(payload)
    .eq("id", appointmentId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to update appointment" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId: existing.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "appointment.updated",
      entityType: "appointment",
      entityId: appointmentId,
      oldValues: existing,
      newValues: data,
    });
  }

  return { success: true, data: data as AppointmentRecord };
}

/**
 * Cancels an appointment and records cancellation notes.
 */
export async function cancelAppointment(
  client: SupabaseClient<any, any, any>,
  appointmentId: string,
  reason?: string,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await client
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!existing) {
    return { success: false, error: "Appointment not found" };
  }

  const updatedNotes = reason
    ? `${existing.companion_notes ? existing.companion_notes + " | " : ""}Cancelled: ${reason}`
    : existing.companion_notes;

  const { data, error } = await client
    .from("appointments")
    .update({
      status: "cancelled",
      companion_notes: updatedNotes,
    })
    .eq("id", appointmentId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to cancel appointment" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId: existing.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "appointment.cancelled",
      entityType: "appointment",
      entityId: appointmentId,
      oldValues: existing,
      newValues: data,
    });
  }

  return { success: true };
}
