import { describe, it, expect } from "vitest";
import {
  medicationCreateSchema,
  medicationUpdateSchema,
  scheduleCreateSchema,
} from "@/lib/validations/medication";
import {
  generateExpectedDoseSlots,
  resolveScheduleTime,
  ScheduleRecord,
  DEFAULT_SLOT_TIMES,
} from "@/services/schedule-service";

describe("Medication & Schedule Validation and Generation", () => {
  describe("Medication Schema Validation", () => {
    it("validates a compliant medication input", () => {
      const input = {
        name: "Lisinopril",
        strength: "10mg",
        instructions: "Take 1 tablet every morning with water",
        prescribing_doctor: "Dr. Sarah Adams",
        rx_number: "RX-99210",
        warnings: "May cause lightheadedness when standing up quickly",
        status: "active" as const,
      };

      const result = medicationCreateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Lisinopril");
        expect(result.data.status).toBe("active");
      }
    });

    it("applies default active status when omitted", () => {
      const input = {
        name: "Metformin",
        strength: "500mg",
        instructions: "Take with evening meal",
      };

      const result = medicationCreateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("active");
        expect(result.data.prescribing_doctor).toBeUndefined();
      }
    });

    it("rejects empty medication name, strength, or instructions", () => {
      const invalid = {
        name: "   ",
        strength: "",
        instructions: "",
      };

      const result = medicationCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path[0]);
        expect(issues).toContain("name");
        expect(issues).toContain("strength");
        expect(issues).toContain("instructions");
      }
    });

    it("validates partial updates with medicationUpdateSchema", () => {
      const partial = {
        instructions: "Take with a full glass of water after breakfast",
        warnings: "Do not crush or chew",
      };

      const result = medicationUpdateSchema.safeParse(partial);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instructions).toBe("Take with a full glass of water after breakfast");
      }
    });
  });

  describe("Schedule Schema Validation", () => {
    it("validates valid schedule with default 7-day schedule", () => {
      const input = {
        medication_id: "00000000-0000-0000-0000-000000000001",
        elder_id: "00000000-0000-0000-0000-000000000002",
        time_of_day: "morning" as const,
        dose_amount: "1 tablet",
      };

      const result = scheduleCreateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days_of_week).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(result.data.active).toBe(true);
      }
    });

    it("validates custom time with valid HH:MM format", () => {
      const input = {
        medication_id: "00000000-0000-0000-0000-000000000001",
        elder_id: "00000000-0000-0000-0000-000000000002",
        time_of_day: "custom" as const,
        exact_time: "14:30",
        days_of_week: [1, 3, 5],
        dose_amount: "2 drops",
      };

      const result = scheduleCreateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exact_time).toBe("14:30");
        expect(result.data.days_of_week).toEqual([1, 3, 5]);
      }
    });

    it("rejects invalid exact_time format", () => {
      const invalid = {
        medication_id: "00000000-0000-0000-0000-000000000001",
        elder_id: "00000000-0000-0000-0000-000000000002",
        time_of_day: "custom" as const,
        exact_time: "25:70", // Invalid hour and minute
      };

      const result = scheduleCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects empty days_of_week array and out-of-range days", () => {
      const emptyDays = {
        medication_id: "00000000-0000-0000-0000-000000000001",
        elder_id: "00000000-0000-0000-0000-000000000002",
        time_of_day: "morning" as const,
        days_of_week: [],
      };

      expect(scheduleCreateSchema.safeParse(emptyDays).success).toBe(false);

      const outOfRange = {
        medication_id: "00000000-0000-0000-0000-000000000001",
        elder_id: "00000000-0000-0000-0000-000000000002",
        time_of_day: "morning" as const,
        days_of_week: [7], // 0-6 only
      };

      expect(scheduleCreateSchema.safeParse(outOfRange).success).toBe(false);
    });
  });

  describe("Schedule Time Resolution", () => {
    it("resolves default slot times correctly", () => {
      expect(resolveScheduleTime("morning")).toBe(DEFAULT_SLOT_TIMES.morning);
      expect(resolveScheduleTime("afternoon")).toBe(DEFAULT_SLOT_TIMES.afternoon);
      expect(resolveScheduleTime("evening")).toBe(DEFAULT_SLOT_TIMES.evening);
      expect(resolveScheduleTime("bedtime")).toBe(DEFAULT_SLOT_TIMES.bedtime);
      expect(resolveScheduleTime("custom")).toBe(DEFAULT_SLOT_TIMES.custom);
    });

    it("prefers exact_time over slot defaults when provided", () => {
      expect(resolveScheduleTime("morning", "07:15")).toBe("07:15");
      expect(resolveScheduleTime("bedtime", "22:45")).toBe("22:45");
    });
  });

  describe("Deterministic Expected Dose Slot Generator", () => {
    const mockSchedule: ScheduleRecord = {
      id: "sched-1",
      medication_id: "med-1",
      elder_id: "elder-1",
      time_of_day: "morning",
      exact_time: null,
      days_of_week: [0, 1, 2, 3, 4, 5, 6], // Daily
      dose_amount: "1 pill",
      active: true,
      created_at: "2026-11-01T00:00:00.000Z",
    };

    it("generates exactly 3 slots for a 3-day daily schedule range", () => {
      const slots = generateExpectedDoseSlots(mockSchedule, "2026-11-15", "2026-11-17");
      expect(slots).toHaveLength(3);

      expect(slots[0]).toEqual({
        scheduleId: "sched-1",
        medicationId: "med-1",
        elderId: "elder-1",
        timeOfDay: "morning",
        doseAmount: "1 pill",
        scheduledFor: "2026-11-15T08:00:00.000Z",
        dateString: "2026-11-15",
        timeString: "08:00",
      });

      expect(slots[1].dateString).toBe("2026-11-16");
      expect(slots[1].scheduledFor).toBe("2026-11-16T08:00:00.000Z");

      expect(slots[2].dateString).toBe("2026-11-17");
      expect(slots[2].scheduledFor).toBe("2026-11-17T08:00:00.000Z");
    });

    it("respects days_of_week filter (e.g. weekdays only)", () => {
      // 2026-11-13 (Fri=5), 2026-11-14 (Sat=6), 2026-11-15 (Sun=0), 2026-11-16 (Mon=1)
      const weekdaySchedule: ScheduleRecord = {
        ...mockSchedule,
        days_of_week: [1, 2, 3, 4, 5], // Monday through Friday
      };

      const slots = generateExpectedDoseSlots(weekdaySchedule, "2026-11-13", "2026-11-16");
      // Should include Friday (13) and Monday (16), but skip Saturday (14) and Sunday (15)
      expect(slots).toHaveLength(2);
      expect(slots[0].dateString).toBe("2026-11-13");
      expect(slots[1].dateString).toBe("2026-11-16");
    });

    it("returns empty array when schedule is inactive", () => {
      const inactiveSchedule: ScheduleRecord = {
        ...mockSchedule,
        active: false,
      };

      const slots = generateExpectedDoseSlots(inactiveSchedule, "2026-11-15", "2026-11-20");
      expect(slots).toEqual([]);
    });

    it("returns empty array when startDate is after endDate", () => {
      const slots = generateExpectedDoseSlots(mockSchedule, "2026-11-20", "2026-11-15");
      expect(slots).toEqual([]);
    });

    it("generates slots for single-day query", () => {
      const slots = generateExpectedDoseSlots(mockSchedule, "2026-11-15", "2026-11-15");
      expect(slots).toHaveLength(1);
      expect(slots[0].dateString).toBe("2026-11-15");
    });

    it("honors exact_time override in generated ISO timestamp", () => {
      const customTimeSchedule: ScheduleRecord = {
        ...mockSchedule,
        time_of_day: "custom",
        exact_time: "15:45",
      };

      const slots = generateExpectedDoseSlots(customTimeSchedule, "2026-11-15", "2026-11-15");
      expect(slots).toHaveLength(1);
      expect(slots[0].timeString).toBe("15:45");
      expect(slots[0].scheduledFor).toBe("2026-11-15T15:45:00.000Z");
    });
  });
});
