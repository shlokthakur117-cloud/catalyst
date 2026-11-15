import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Json } from "@/types/database";

export interface LogAuditEventParams {
  elderId: string;
  actorId?: string | null;
  actorRole: "elder" | "caregiver" | "system";
  action: string;
  entityType: "dose_log" | "medication" | "medication_schedule" | "caregiver_alert" | "appointment" | "care_relationship";
  entityId: string;
  oldValues?: Json | null;
  newValues?: Json | null;
}

/**
 * Emits an immutable audit log entry into public.audit_logs.
 * The database RLS strictly permits INSERT and SELECT only — UPDATE and DELETE are disallowed.
 */
export async function emitAuditLog(
  supabase: SupabaseClient<any, any, any>,
  params: LogAuditEventParams
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    elder_id: params.elderId,
    actor_id: params.actorId || null,
    actor_role: params.actorRole,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_values: params.oldValues || null,
    new_values: params.newValues || null,
  });

  if (error) {
    console.error("Failed to emit audit log:", error);
    // Fail-safe: In critical healthcare tracking, audit failure must be surfaced
    throw new Error(`Audit logging failed: ${error.message}`);
  }
}
