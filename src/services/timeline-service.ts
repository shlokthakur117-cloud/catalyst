import { SupabaseClient } from "@supabase/supabase-js";

export type TimelineCategory = "all" | "medication" | "alert" | "appointment";

export interface TimelineItem {
  id: string;
  timestamp: string;
  category: "medication" | "alert" | "appointment" | "system";
  action: string;
  title: string;
  description: string;
  actorRole: "elder" | "caregiver" | "system";
  actorName: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  changedFields: string[];
}

/**
 * Computes changed field keys between oldValues and newValues
 */
export function computeChangedFields(
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null
): string[] {
  if (!oldValues && !newValues) return [];
  if (!oldValues && newValues) return Object.keys(newValues);
  if (oldValues && !newValues) return Object.keys(oldValues);

  const changed: string[] = [];
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  for (const key of allKeys) {
    const oldVal = (oldValues as any)?.[key];
    const newVal = (newValues as any)?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * Derives human-friendly title, description, and category from raw audit log
 */
export function formatAuditEntry(log: any, actorName?: string): {
  category: "medication" | "alert" | "appointment" | "system";
  title: string;
  description: string;
} {
  const action = log.action || "";
  const entityType = log.entity_type || "";
  const newVals = log.new_values || {};
  const oldVals = log.old_values || {};

  // 1. Medication & Dose events
  if (entityType === "dose_log" || action.includes("dose")) {
    const status = newVals.status || "";
    const medName = newVals.medication_name || oldVals.medication_name || "Prescription Dose";

    if (status === "taken") {
      return {
        category: "medication",
        title: `${medName} Confirmed Taken`,
        description: newVals.notes || "Reported dose ingestion affirmatively.",
      };
    }
    if (status === "not_yet") {
      return {
        category: "medication",
        title: `${medName} Postponed ("Not Yet")`,
        description: newVals.notes || "Elder indicated they have not taken this dose yet.",
      };
    }
    if (status === "unsure") {
      return {
        category: "medication",
        title: `${medName} Reported Unsure`,
        description: newVals.notes || "Elder expressed uncertainty regarding medication ingestion.",
      };
    }
    if (status === "unconfirmed") {
      return {
        category: "medication",
        title: `${medName} Marked Unconfirmed`,
        description: "Grace period elapsed without confirmation. Escalated to care circle.",
      };
    }
    if (status === "skipped") {
      return {
        category: "medication",
        title: `${medName} Skipped`,
        description: newVals.notes || "Medication explicitly marked as skipped.",
      };
    }
    return {
      category: "medication",
      title: `${medName} Dose Updated`,
      description: `Dose status updated to ${status || "new state"}.`,
    };
  }

  // 2. Alert & Escalation events
  if (entityType === "caregiver_alert" || action.includes("alert")) {
    if (action.includes("claim")) {
      return {
        category: "alert",
        title: "Alert Responsibility Claimed",
        description: `${actorName || "Caregiver"} claimed responsibility to follow up with elder.`,
      };
    }
    if (action.includes("resolve")) {
      const notes = newVals.resolution_notes || newVals.resolutionNotes || "";
      return {
        category: "alert",
        title: "Escalation Alert Resolved",
        description: notes ? `Resolved with notes: "${notes}"` : "Caregiver confirmed ingestion and closed alert.",
      };
    }
    return {
      category: "alert",
      title: "Caregiver Escalation Alert Opened",
      description: `Urgent alert created (${newVals.alertType || newVals.alert_type || "dose alert"}).`,
    };
  }

  // 3. Medication & Prescription adjustments
  if (entityType === "medication" || entityType === "medication_schedule") {
    if (action.includes("create")) {
      return {
        category: "medication",
        title: `Prescription Added: ${newVals.name || "New Medication"}`,
        description: `${newVals.strength || newVals.dosage || ""} ${newVals.instructions || ""}`.trim() || "Prescription registered.",
      };
    }
    return {
      category: "medication",
      title: `Prescription Modified: ${newVals.name || oldVals.name || "Medication"}`,
      description: "Medication or schedule regimen adjusted.",
    };
  }

  // 4. Appointments
  if (entityType === "appointment" || action.includes("appointment")) {
    if (action.includes("create")) {
      return {
        category: "appointment",
        title: `Appointment Scheduled: ${newVals.title || "Medical Visit"}`,
        description: `${newVals.provider_name ? `With ${newVals.provider_name}. ` : ""}${newVals.notes || ""}`.trim(),
      };
    }
    return {
      category: "appointment",
      title: `Appointment Updated: ${newVals.title || oldVals.title || "Medical Visit"}`,
      description: `Status changed to ${newVals.status || "updated"}.`,
    };
  }

  return {
    category: "system",
    title: action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: `Action recorded on ${entityType}.`,
  };
}

/**
 * Fetches all audit log entries for a given elder and normalizes them into timeline items
 */
export async function getElderTimeline(
  supabase: SupabaseClient<any, any, any>,
  elderId: string,
  limit: number = 50
): Promise<TimelineItem[]> {
  const { data: rawLogs, error } = await supabase
    .from("audit_logs")
    .select("*, profiles!actor_id(full_name, role)")
    .eq("elder_id", elderId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Could not query audit_logs table, falling back to empty list:", error.message);
    return [];
  }

  if (!rawLogs || rawLogs.length === 0) {
    return [];
  }

  return rawLogs.map((log: any): TimelineItem => {
    const actorRole = (log.actor_role as "elder" | "caregiver" | "system") || "system";
    let actorName = log.profiles?.full_name || "";
    if (!actorName) {
      if (actorRole === "elder") actorName = "Elder";
      else if (actorRole === "caregiver") actorName = "Caregiver";
      else actorName = "CareLedger System";
    }

    const { category, title, description } = formatAuditEntry(log, actorName);
    const changedFields = computeChangedFields(log.old_values, log.new_values);

    return {
      id: log.id,
      timestamp: log.created_at,
      category,
      action: log.action,
      title,
      description,
      actorRole,
      actorName,
      entityType: log.entity_type,
      entityId: log.entity_id,
      oldValues: log.old_values,
      newValues: log.new_values,
      changedFields,
    };
  });
}
