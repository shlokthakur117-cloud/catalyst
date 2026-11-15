import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAppointment,
  getAppointmentsForElder,
  updateAppointment,
  cancelAppointment,
} from "@/services/appointment-service";
import { appointmentCreateSchema } from "@/lib/validations/appointment";

function createMockQueryChain(defaultResolvedValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.then = (onFulfilled: any) => Promise.resolve(defaultResolvedValue).then(onFulfilled);
  return chain;
}

const ELDER_ID = "00000000-0000-0000-0000-000000000001";
const CAREGIVER_ID = "00000000-0000-0000-0000-000000000002";

describe("Appointment Service & Companion Notes", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };
  });

  describe("Validation", () => {
    it("validates a compliant medical appointment", () => {
      const input = {
        elder_id: ELDER_ID,
        title: "Cardiology Checkup",
        doctor_name: "Dr. Robert Chen",
        clinic_address: "St. Jude Heart Center, Suite 402",
        scheduled_at: "2026-11-20T10:00:00.000Z",
        companion_notes: "Bring blood pressure readings log",
        status: "upcoming" as const,
      };

      const res = appointmentCreateSchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.doctor_name).toBe("Dr. Robert Chen");
        expect(res.data.status).toBe("upcoming");
      }
    });

    it("rejects appointment missing required doctor name or invalid elder UUID", () => {
      const invalid = {
        elder_id: "not-a-uuid",
        title: "Cardiology Checkup",
        doctor_name: "",
        scheduled_at: "2026-11-20T10:00:00.000Z",
      };

      const res = appointmentCreateSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issues = res.error.issues.map((i) => i.path[0]);
        expect(issues).toContain("elder_id");
        expect(issues).toContain("doctor_name");
      }
    });
  });

  describe("CRUD Operations", () => {
    it("creates an appointment record and emits an audit event", async () => {
      const createdAppt = {
        id: "appt-1",
        elder_id: ELDER_ID,
        title: "Cardiology Checkup",
        doctor_name: "Dr. Robert Chen",
        clinic_address: "St. Jude Heart Center",
        scheduled_at: "2026-11-20T10:00:00.000Z",
        companion_notes: "Bring blood pressure readings",
        status: "upcoming",
        created_at: new Date().toISOString(),
      };

      const apptChain = createMockQueryChain({ data: createdAppt, error: null });
      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "appointments") return apptChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const res = await createAppointment(
        mockSupabase,
        {
          elder_id: ELDER_ID,
          title: "Cardiology Checkup",
          doctor_name: "Dr. Robert Chen",
          clinic_address: "St. Jude Heart Center",
          scheduled_at: "2026-11-20T10:00:00.000Z",
          companion_notes: "Bring blood pressure readings",
        },
        { actorId: CAREGIVER_ID, actorRole: "caregiver" }
      );

      expect(res.success).toBe(true);
      expect(res.data?.id).toBe("appt-1");
      expect(auditChain.insert).toHaveBeenCalledTimes(1);
    });

    it("retrieves appointments chronologically", async () => {
      const mockList = [
        {
          id: "appt-1",
          title: "Visit 1",
          scheduled_at: "2026-11-18T09:00:00Z",
        },
        {
          id: "appt-2",
          title: "Visit 2",
          scheduled_at: "2026-11-22T14:00:00Z",
        },
      ];

      const apptChain = createMockQueryChain({ data: mockList, error: null });
      mockSupabase.from.mockImplementation(() => apptChain);

      const res = await getAppointmentsForElder(mockSupabase, ELDER_ID);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
      expect(apptChain.order).toHaveBeenCalledWith("scheduled_at", { ascending: true });
    });

    it("cancels an appointment and captures cancellation reason", async () => {
      const existingAppt = {
        id: "appt-1",
        elder_id: ELDER_ID,
        title: "Visit 1",
        companion_notes: "Initial note",
        status: "upcoming",
      };

      const updatedAppt = {
        ...existingAppt,
        status: "cancelled",
        companion_notes: "Initial note | Cancelled: Doctor was rescheduled by clinic",
      };

      const apptChain = createMockQueryChain();
      apptChain.single
        .mockResolvedValueOnce({ data: existingAppt, error: null })
        .mockResolvedValueOnce({ data: updatedAppt, error: null });

      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "appointments") return apptChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const res = await cancelAppointment(
        mockSupabase,
        "appt-1",
        "Doctor was rescheduled by clinic",
        { actorId: CAREGIVER_ID, actorRole: "caregiver" }
      );

      expect(res.success).toBe(true);
      expect(auditChain.insert).toHaveBeenCalledTimes(1);
    });
  });
});
