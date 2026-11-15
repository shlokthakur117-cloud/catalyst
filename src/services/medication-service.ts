import { SupabaseClient } from "@supabase/supabase-js";
import {
  medicationCreateSchema,
  medicationUpdateSchema,
  MedicationCreateInput,
  MedicationUpdateInput,
} from "@/lib/validations/medication";
import { emitAuditLog } from "./audit-service";
import { MedicationStatus } from "@/types/database";

export interface MedicationRecord {
  id: string;
  elder_id: string;
  name: string;
  strength: string;
  instructions: string;
  prescribing_doctor: string | null;
  rx_number: string | null;
  warnings: string | null;
  status: MedicationStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new prescription record for an elder.
 * Strictly validates against the medication Zod schema.
 */
export async function createMedication(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  input: MedicationCreateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: MedicationRecord; error?: string }> {
  const validated = medicationCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data, error } = await client
    .from("medications")
    .insert({
      elder_id: elderId,
      name: validated.data.name,
      strength: validated.data.strength,
      instructions: validated.data.instructions,
      prescribing_doctor: validated.data.prescribing_doctor || null,
      rx_number: validated.data.rx_number || null,
      warnings: validated.data.warnings || null,
      status: validated.data.status,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create medication" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "medication.created",
      entityType: "medication",
      entityId: data.id,
      newValues: data,
    });
  }

  return { success: true, data: data as MedicationRecord };
}

/**
 * Retrieves a single medication by ID.
 */
export async function getMedicationById(
  client: SupabaseClient<any, any, any>,
  medicationId: string
): Promise<{ success: boolean; data?: MedicationRecord | null; error?: string }> {
  const { data, error } = await client
    .from("medications")
    .select("*")
    .eq("id", medicationId)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data as MedicationRecord) || null };
}

/**
 * Lists all medications for a specific elder.
 */
export async function listMedicationsForElder(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  options: { activeOnly?: boolean } = { activeOnly: true }
): Promise<{ success: boolean; data: MedicationRecord[]; error?: string }> {
  let query = client
    .from("medications")
    .select("*")
    .eq("elder_id", elderId)
    .order("created_at", { ascending: false });

  if (options.activeOnly) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, data: [], error: error.message };
  }

  return { success: true, data: (data as MedicationRecord[]) || [] };
}

/**
 * Updates a medication with partial inputs.
 * Emits an immutable audit log if actor context is provided.
 */
export async function updateMedication(
  client: SupabaseClient<any, any, any>,
  medicationId: string,
  input: MedicationUpdateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: MedicationRecord; error?: string }> {
  const validated = medicationUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  // Fetch current row for audit before mutating
  const { data: existing } = await client
    .from("medications")
    .select("*")
    .eq("id", medicationId)
    .single();

  const updatePayload: Record<string, any> = {
    ...validated.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("medications")
    .update(updatePayload)
    .eq("id", medicationId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to update medication" };
  }

  if (actorContext && existing) {
    await emitAuditLog(client, {
      elderId: existing.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "medication.updated",
      entityType: "medication",
      entityId: medicationId,
      oldValues: existing,
      newValues: data,
    });
  }

  return { success: true, data: data as MedicationRecord };
}

/**
 * Marks a medication as discontinued.
 */
export async function discontinueMedication(
  client: SupabaseClient<any, any, any>,
  medicationId: string,
  reason?: string,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: MedicationRecord; error?: string }> {
  const { data: existing } = await client
    .from("medications")
    .select("*")
    .eq("id", medicationId)
    .single();

  if (!existing) {
    return { success: false, error: "Medication not found" };
  }

  const updatedWarnings = reason
    ? `${existing.warnings ? existing.warnings + " | " : ""}Discontinued: ${reason}`
    : existing.warnings;

  const { data, error } = await client
    .from("medications")
    .update({
      status: "discontinued",
      warnings: updatedWarnings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicationId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to discontinue medication" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId: existing.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "medication.discontinued",
      entityType: "medication",
      entityId: medicationId,
      oldValues: existing,
      newValues: data,
    });
  }

  return { success: true, data: data as MedicationRecord };
}
