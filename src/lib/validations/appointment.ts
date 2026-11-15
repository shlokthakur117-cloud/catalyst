import { z } from "zod";

export const appointmentStatusEnum = z.enum(["upcoming", "completed", "cancelled"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusEnum>;

export const appointmentCreateSchema = z.object({
  elder_id: z.string().uuid("Invalid elder ID"),
  title: z.string().trim().min(1, "Appointment title is required").max(120, "Title is too long"),
  doctor_name: z.string().trim().min(1, "Doctor name is required").max(120, "Doctor name is too long"),
  clinic_address: z.string().trim().max(250, "Address is too long").optional().nullable(),
  scheduled_at: z.string().min(1, "Scheduled date and time is required"),
  companion_notes: z.string().trim().max(1000, "Notes are too long").optional().nullable(),
  status: appointmentStatusEnum.default("upcoming"),
});

export const appointmentUpdateSchema = appointmentCreateSchema.partial();

export type AppointmentCreateInput = z.input<typeof appointmentCreateSchema>;
export type AppointmentUpdateInput = z.input<typeof appointmentUpdateSchema>;
