import { SupabaseClient } from "@supabase/supabase-js";
import {
  scheduleCreateSchema,
  scheduleUpdateSchema,
  ScheduleCreateInput,
  ScheduleUpdateInput,
  TimeOfDay,
} from "@/lib/validations/medication";
import { emitAuditLog } from "./audit-service";

export const DEFAULT_SLOT_TIMES: Record<TimeOfDay, string> = {
  morning: "08:00",
  afternoon: "13:00",
  evening: "18:00",
  bedtime: "21:00",
  custom: "09:00",
};

export interface ScheduleRecord {
  id: string;
  medication_id: string;
  elder_id: string;
  time_of_day: string;
  exact_time: string | null;
  days_of_week: number[];
  dose_amount: string;
  active: boolean;
  created_at: string;
}

export interface ExpectedDoseSlot {
  scheduleId: string;
  medicationId: string;
  elderId: string;
  timeOfDay: TimeOfDay;
  doseAmount: string;
  scheduledFor: string; // ISO 8601
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM
}

/**
 * Resolves the scheduled time string (HH:MM) for a schedule.
 * Exact time takes precedence over default slot times.
 */
export function resolveScheduleTime(timeOfDay: string, exactTime?: string | null): string {
  if (exactTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(exactTime)) {
    return exactTime;
  }
  const normalized = timeOfDay.toLowerCase() as TimeOfDay;
  return DEFAULT_SLOT_TIMES[normalized] || DEFAULT_SLOT_TIMES.morning;
}

/**
 * Pure deterministic generator that creates expected dose slots for a given schedule
 * between startDate (inclusive) and endDate (inclusive) in YYYY-MM-DD format.
 *
 * Invariant:
 * Generated slots represent scheduled events and DO NOT imply medication ingestion.
 */
export function generateExpectedDoseSlots(
  schedule: ScheduleRecord,
  startDateStr: string,
  endDateStr: string
): ExpectedDoseSlot[] {
  if (!schedule.active) {
    return [];
  }

  const slots: ExpectedDoseSlot[] = [];

  const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);

  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  if (start > end) {
    return [];
  }

  const timeString = resolveScheduleTime(schedule.time_of_day, schedule.exact_time);
  const [hours, minutes] = timeString.split(":").map(Number);

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    if (schedule.days_of_week.includes(dayOfWeek)) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      const day = String(current.getUTCDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      const scheduledDate = new Date(Date.UTC(year, current.getUTCMonth(), current.getUTCDate(), hours, minutes, 0, 0));

      slots.push({
        scheduleId: schedule.id,
        medicationId: schedule.medication_id,
        elderId: schedule.elder_id,
        timeOfDay: (schedule.time_of_day.toLowerCase() as TimeOfDay) || "morning",
        doseAmount: schedule.dose_amount || "1 pill",
        scheduledFor: scheduledDate.toISOString(),
        dateString,
        timeString,
      });
    }

    // Advance 1 calendar day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return slots;
}

/**
 * Creates a recurring schedule entry for a medication.
 */
export async function createSchedule(
  client: SupabaseClient<any, any, any>,
  input: ScheduleCreateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: ScheduleRecord; error?: string }> {
  const validated = scheduleCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data, error } = await client
    .from("medication_schedules")
    .insert({
      medication_id: validated.data.medication_id,
      elder_id: validated.data.elder_id,
      time_of_day: validated.data.time_of_day,
      exact_time: validated.data.exact_time || null,
      days_of_week: validated.data.days_of_week,
      dose_amount: validated.data.dose_amount,
      active: validated.data.active,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create schedule" };
  }

  if (actorContext) {
    await emitAuditLog(client, {
      elderId: validated.data.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "schedule.created",
      entityType: "medication_schedule",
      entityId: data.id,
      newValues: data,
    });
  }

  return { success: true, data: data as ScheduleRecord };
}

/**
 * Lists all active schedules for a given elder.
 */
export async function getSchedulesForElder(
  client: SupabaseClient<any, any, any>,
  elderId: string,
  options: { activeOnly?: boolean } = { activeOnly: true }
): Promise<{ success: boolean; data: ScheduleRecord[]; error?: string }> {
  let query = client
    .from("medication_schedules")
    .select("*")
    .eq("elder_id", elderId)
    .order("created_at", { ascending: true });

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, data: [], error: error.message };
  }

  return { success: true, data: (data as ScheduleRecord[]) || [] };
}

/**
 * Lists all schedules for a specific medication.
 */
export async function getSchedulesForMedication(
  client: SupabaseClient<any, any, any>,
  medicationId: string
): Promise<{ success: boolean; data: ScheduleRecord[]; error?: string }> {
  const { data, error } = await client
    .from("medication_schedules")
    .select("*")
    .eq("medication_id", medicationId)
    .order("created_at", { ascending: true });

  if (error) {
    return { success: false, data: [], error: error.message };
  }

  return { success: true, data: (data as ScheduleRecord[]) || [] };
}

/**
 * Updates a schedule and audits changes.
 */
export async function updateSchedule(
  client: SupabaseClient<any, any, any>,
  scheduleId: string,
  input: ScheduleUpdateInput,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; data?: ScheduleRecord; error?: string }> {
  const validated = scheduleUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data: existing } = await client
    .from("medication_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();

  const { data, error } = await client
    .from("medication_schedules")
    .update(validated.data)
    .eq("id", scheduleId)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to update schedule" };
  }

  if (actorContext && existing) {
    await emitAuditLog(client, {
      elderId: existing.elder_id,
      actorId: actorContext.actorId,
      actorRole: actorContext.actorRole,
      action: "schedule.updated",
      entityType: "medication_schedule",
      entityId: scheduleId,
      oldValues: existing,
      newValues: data,
    });
  }

  return { success: true, data: data as ScheduleRecord };
}

/**
 * Deactivates a schedule (soft delete to preserve historical integrity).
 */
export async function deactivateSchedule(
  client: SupabaseClient<any, any, any>,
  scheduleId: string,
  actorContext?: { actorId: string; actorRole: "elder" | "caregiver" }
): Promise<{ success: boolean; error?: string }> {
  return updateSchedule(client, scheduleId, { active: false }, actorContext).then((res) => ({
    success: res.success,
    error: res.error,
  }));
}
