import { z } from "zod";

export const timeOfDayEnum = z.enum(["morning", "afternoon", "evening", "bedtime", "custom"]);
export type TimeOfDay = z.infer<typeof timeOfDayEnum>;

export const dayOfWeekSchema = z.number().int().min(0, "Day must be between 0 (Sunday) and 6 (Saturday)").max(6, "Day must be between 0 (Sunday) and 6 (Saturday)");

export const medicationCreateSchema = z.object({
  name: z.string().trim().min(1, "Medication name is required").max(120, "Medication name too long"),
  strength: z.string().trim().min(1, "Strength is required (e.g., 10mg)").max(60, "Strength text too long"),
  instructions: z.string().trim().min(1, "Instructions are required (e.g., Take with food)").max(500, "Instructions too long"),
  prescribing_doctor: z.string().trim().max(120).optional().nullable(),
  rx_number: z.string().trim().max(60).optional().nullable(),
  warnings: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["active", "discontinued"]).default("active"),
});

export const medicationUpdateSchema = medicationCreateSchema.partial();

export const scheduleCreateSchema = z.object({
  medication_id: z.string().uuid("Invalid medication ID"),
  elder_id: z.string().uuid("Invalid elder ID"),
  time_of_day: timeOfDayEnum,
  exact_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in 24-hour HH:MM format (e.g. 08:00)")
    .optional()
    .nullable(),
  days_of_week: z
    .array(dayOfWeekSchema)
    .min(1, "At least one day of the week must be selected")
    .default([0, 1, 2, 3, 4, 5, 6]),
  dose_amount: z.string().trim().min(1, "Dose amount is required").max(60).default("1 pill"),
  active: z.boolean().default(true),
});

export const scheduleUpdateSchema = scheduleCreateSchema.partial();

export const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
});

export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>;
export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>;
export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type DateRangeQueryInput = z.infer<typeof dateRangeQuerySchema>;
