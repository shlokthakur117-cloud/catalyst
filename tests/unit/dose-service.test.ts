import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordDoseTransition,
  escalateOverdueDosesForElder,
  DoseWithMedication,
} from "@/services/dose-service";

function createMockQueryChain(defaultResolvedValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(defaultResolvedValue);
  return chain;
}

describe("Dose Service — Database Integration & Invariants", () => {
  let mockDoseRow: DoseWithMedication;

  beforeEach(() => {
    mockDoseRow = {
      id: "dose-100",
      schedule_id: "sched-1",
      medication_id: "med-1",
      elder_id: "elder-1",
      scheduled_for: "2026-11-15T08:00:00.000Z",
      status: "scheduled",
      reminded_at: null,
      confirmed_at: null,
      confirmed_by: null,
      actor_role: null,
      notes: null,
      created_at: "2026-11-15T00:00:00.000Z",
      updated_at: "2026-11-15T00:00:00.000Z",
      medications: {
        name: "Lisinopril",
        strength: "10mg",
        instructions: "Take with water",
      },
    };
  });

  describe("recordDoseTransition", () => {
    it("allows elder to confirm ingestion ('taken') with confirmed timestamp and audit trail", async () => {
      const updatedRow = {
        ...mockDoseRow,
        status: "taken" as const,
        confirmed_at: "2026-11-15T08:05:00.000Z",
        confirmed_by: "elder-1",
        actor_role: "elder" as const,
      };

      const doseLogsChain = createMockQueryChain();
      // First call is fetch (single), second is update (single)
      doseLogsChain.single
        .mockResolvedValueOnce({ data: { ...mockDoseRow }, error: null })
        .mockResolvedValueOnce({ data: updatedRow, error: null });

      const auditLogsChain = createMockQueryChain();

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "dose_logs") return doseLogsChain;
          if (table === "audit_logs") return auditLogsChain;
          return createMockQueryChain();
        },
      };

      const res = await recordDoseTransition(mockSupabase, {
        doseId: "dose-100",
        toStatus: "taken",
        actorId: "elder-1",
        actorRole: "elder",
        timestamp: "2026-11-15T08:05:00.000Z",
      });

      expect(res.success).toBe(true);
      expect(res.result?.currentStatus).toBe("taken");
      expect(res.result?.requiresCaregiverAlert).toBe(false);
      expect(res.updatedDose?.status).toBe("taken");
      expect(auditLogsChain.insert).toHaveBeenCalledTimes(1);
    });

    it("creates caregiver alert when elder reports 'unsure'", async () => {
      const updatedRow = {
        ...mockDoseRow,
        status: "unsure" as const,
        actor_role: "elder" as const,
        confirmed_by: "elder-1",
        notes: "I can't remember if I took it with breakfast",
      };

      const doseLogsChain = createMockQueryChain();
      doseLogsChain.single
        .mockResolvedValueOnce({ data: { ...mockDoseRow }, error: null })
        .mockResolvedValueOnce({ data: updatedRow, error: null });

      const alertChain = createMockQueryChain();
      // First call is duplicate check via maybeSingle (returns null for new alert)
      alertChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // Second call is insert().select().single()
      alertChain.single.mockResolvedValueOnce({
        data: {
          id: "alert-1",
          elder_id: "elder-1",
          dose_log_id: "dose-100",
          alert_type: "unsure_dose",
          urgency: "high",
          status: "open",
          created_at: "2026-11-15T08:10:00.000Z",
        },
        error: null,
      });

      const auditLogsChain = createMockQueryChain();

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "dose_logs") return doseLogsChain;
          if (table === "caregiver_alerts") return alertChain;
          if (table === "audit_logs") return auditLogsChain;
          return createMockQueryChain();
        },
      };

      const res = await recordDoseTransition(mockSupabase, {
        doseId: "dose-100",
        toStatus: "unsure",
        actorId: "elder-1",
        actorRole: "elder",
        notes: "I can't remember if I took it with breakfast",
      });

      expect(res.success).toBe(true);
      expect(res.result?.requiresCaregiverAlert).toBe(true);
      expect(res.result?.currentStatus).toBe("unsure");
      expect(alertChain.insert).toHaveBeenCalledTimes(1);
    });

    it("strictly blocks system automation from marking a dose as taken", async () => {
      const doseLogsChain = createMockQueryChain({ data: { ...mockDoseRow }, error: null });

      const mockSupabase: any = {
        from: () => doseLogsChain,
      };

      const res = await recordDoseTransition(mockSupabase, {
        doseId: "dose-100",
        toStatus: "taken",
        actorId: "system-job",
        actorRole: "system",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("cannot mark medication as taken");
    });

    it("handles optimistic concurrency conflict when status was changed concurrently", async () => {
      const doseLogsChain = createMockQueryChain();
      doseLogsChain.single
        // 1. Initial fetch
        .mockResolvedValueOnce({ data: { ...mockDoseRow }, error: null })
        // 2. Optimistic update fails because status changed
        .mockResolvedValueOnce({ data: null, error: { message: "No rows updated" } })
        // 3. Second check reveals another actor set it to 'taken'
        .mockResolvedValueOnce({ data: { status: "taken" }, error: null });

      const mockSupabase: any = {
        from: () => doseLogsChain,
      };

      const res = await recordDoseTransition(mockSupabase, {
        doseId: "dose-100",
        toStatus: "not_yet",
        actorId: "elder-1",
        actorRole: "elder",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("concurrently changed to 'taken'");
    });

    it("is idempotent when requested status is already current status", async () => {
      const takenRow = { ...mockDoseRow, status: "taken" as const };
      const doseLogsChain = createMockQueryChain({ data: takenRow, error: null });

      const mockSupabase: any = {
        from: () => doseLogsChain,
      };

      const res = await recordDoseTransition(mockSupabase, {
        doseId: "dose-100",
        toStatus: "taken",
        actorId: "elder-1",
        actorRole: "elder",
      });

      expect(res.success).toBe(true);
      expect(res.updatedDose?.status).toBe("taken");
    });
  });

  describe("escalateOverdueDosesForElder", () => {
    it("escalates doses older than grace period to 'unconfirmed'", async () => {
      const overdueDose = {
        id: "dose-overdue",
        status: "scheduled" as const,
        scheduled_for: "2026-11-15T06:00:00.000Z", // 2 hours ago
        elder_id: "elder-1",
      };

      const freshDose = {
        id: "dose-fresh",
        status: "scheduled" as const,
        scheduled_for: "2026-11-15T07:45:00.000Z", // 15 mins ago, within 60m grace
        elder_id: "elder-1",
      };

      const doseLogsChain = createMockQueryChain();
      // in() returns the list of open doses
      doseLogsChain.in.mockResolvedValueOnce({
        data: [overdueDose, freshDose],
        error: null,
      });

      // recordDoseTransition will do fetch then update for the single overdue dose
      doseLogsChain.single
        .mockResolvedValueOnce({
          data: {
            ...overdueDose,
            medications: { name: "Aspirin", strength: "81mg", instructions: "Daily" },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...overdueDose,
            status: "unconfirmed" as const,
            medications: { name: "Aspirin", strength: "81mg", instructions: "Daily" },
          },
          error: null,
        });

      const alertChain = createMockQueryChain({
        data: { id: "alert-overdue" },
        error: null,
      });

      const auditChain = createMockQueryChain();

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "dose_logs") return doseLogsChain;
          if (table === "caregiver_alerts") return alertChain;
          if (table === "audit_logs") return auditChain;
          return createMockQueryChain();
        },
      };

      const currentTime = new Date("2026-11-15T08:00:00.000Z");
      const summary = await escalateOverdueDosesForElder(mockSupabase, "elder-1", currentTime, 60);

      expect(summary.evaluated).toBe(2);
      expect(summary.escalated).toBe(1);
    });
  });
});
