import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchCaregiverDashboardDataAction,
  createMedicationWithScheduleAction,
  claimAlertAction,
  resolveAlertAction,
  fetchLinkedEldersAction,
} from "@/app/actions/caregiver";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.then = (onFulfilled: any) => Promise.resolve(defaultResolvedValue).then(onFulfilled);
  return chain;
}

const ELDER_ID = "00000000-0000-0000-0000-000000000001";
const CAREGIVER_ID = "00000000-0000-0000-0000-000000000002";
const MED_ID = "00000000-0000-0000-0000-000000000003";

describe("Caregiver Command Center & Adherence Metrics", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: CAREGIVER_ID } },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
  });

  describe("fetchCaregiverDashboardDataAction", () => {
    it("accurately calculates adherence rate based on closed dose windows", async () => {
      const pastTime1 = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
      const pastTime2 = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
      const pastTime3 = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const pastTime4 = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

      const mockDoses = [
        {
          id: "dose-1",
          status: "taken",
          scheduled_for: pastTime1,
          medications: { name: "Lisinopril", strength: "10mg" },
        },
        {
          id: "dose-2",
          status: "taken",
          scheduled_for: pastTime2,
          medications: { name: "Metformin", strength: "500mg" },
        },
        {
          id: "dose-3",
          status: "unconfirmed",
          scheduled_for: pastTime3,
          medications: { name: "Atorvastatin", strength: "20mg" },
        },
        {
          id: "dose-4",
          status: "unsure",
          scheduled_for: pastTime4,
          medications: { name: "Calcium", strength: "600mg" },
        },
      ];

      const elderChain = createMockQueryChain({
        data: { id: ELDER_ID, full_name: "Eleanor Vance", email: "eleanor@careledger.org" },
        error: null,
      });

      const doseLogsChain = createMockQueryChain({
        data: mockDoses,
        error: null,
      });

      const alertsChain = createMockQueryChain({
        data: [
          {
            id: "alert-1",
            elder_id: ELDER_ID,
            alert_type: "unsure_dose",
            status: "open",
          },
        ],
        error: null,
      });

      const medsChain = createMockQueryChain({
        data: [{ id: MED_ID, name: "Lisinopril", strength: "10mg", status: "active" }],
        error: null,
      });

      const schedulesChain = createMockQueryChain({
        data: [{ id: "sched-1", medication_id: MED_ID, active: true }],
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "profiles") return elderChain;
        if (table === "dose_logs") return doseLogsChain;
        if (table === "caregiver_alerts") return alertsChain;
        if (table === "medications") return medsChain;
        if (table === "medication_schedules") return schedulesChain;
        return createMockQueryChain();
      });

      const res = await fetchCaregiverDashboardDataAction(ELDER_ID);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const stats = res.data!.stats;
      expect(stats.totalDoses).toBe(4);
      expect(stats.takenDoses).toBe(2);
      expect(stats.unsureDoses).toBe(1);
      expect(stats.unconfirmedDoses).toBe(1);
      // 2 taken out of 4 total closed windows = 50%
      expect(stats.adherenceRate).toBe(50);
      expect(res.data!.alerts).toHaveLength(1);
    });

    it("includes overdue unescalated 'scheduled' or 'reminded' doses in denominator and excludes future doses", async () => {
      const pastOverdueTime = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // 2 hours ago (> 60m grace)
      const futureTime = new Date(Date.now() + 4 * 3600 * 1000).toISOString(); // 4 hours in future

      const mockDoses = [
        {
          id: "dose-taken",
          status: "taken",
          scheduled_for: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          medications: { name: "Lisinopril", strength: "10mg" },
        },
        {
          id: "dose-overdue-scheduled",
          status: "scheduled", // Unescalated overdue dose! Still 'scheduled' in DB
          scheduled_for: pastOverdueTime,
          medications: { name: "Metformin", strength: "500mg" },
        },
        {
          id: "dose-future",
          status: "scheduled", // Future dose: window has NOT closed
          scheduled_for: futureTime,
          medications: { name: "Atorvastatin", strength: "20mg" },
        },
      ];

      const elderChain = createMockQueryChain({
        data: { id: ELDER_ID, full_name: "Eleanor Vance", email: "eleanor@careledger.org" },
        error: null,
      });

      const doseLogsChain = createMockQueryChain({
        data: mockDoses,
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "profiles") return elderChain;
        if (table === "dose_logs") return doseLogsChain;
        return createMockQueryChain();
      });

      const res = await fetchCaregiverDashboardDataAction(ELDER_ID);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const stats = res.data!.stats;
      // Denominator must be 2: dose-taken (closed) + dose-overdue-scheduled (closed overdue window)
      // Future dose must be EXCLUDED from denominator!
      expect(stats.totalDoses).toBe(2);
      expect(stats.takenDoses).toBe(1);
      expect(stats.overdueUnescalatedDoses).toBe(1);
      expect(stats.pendingOpenDoses).toBe(1);
      // 1 taken out of 2 expected closed doses = 50%
      expect(stats.adherenceRate).toBe(50);
      expect(stats.adherenceRateDisplay).toBe("50%");
    });

    it("returns null and 'N/A' display when eligible dose count is zero", async () => {
      const futureTime = new Date(Date.now() + 6 * 3600 * 1000).toISOString();

      const mockDoses = [
        {
          id: "dose-future-1",
          status: "scheduled",
          scheduled_for: futureTime,
          medications: { name: "Lisinopril", strength: "10mg" },
        },
      ];

      const elderChain = createMockQueryChain({
        data: { id: ELDER_ID, full_name: "Eleanor Vance", email: "eleanor@careledger.org" },
        error: null,
      });

      const doseLogsChain = createMockQueryChain({
        data: mockDoses,
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "profiles") return elderChain;
        if (table === "dose_logs") return doseLogsChain;
        return createMockQueryChain();
      });

      const res = await fetchCaregiverDashboardDataAction(ELDER_ID);
      expect(res.success).toBe(true);
      expect(res.data?.stats.totalDoses).toBe(0);
      expect(res.data?.stats.takenDoses).toBe(0);
      expect(res.data?.stats.adherenceRate).toBeNull();
      expect(res.data?.stats.adherenceRateDisplay).toBe("N/A");
    });

    it("returns 0% when eligible doses exist but none are reported taken", async () => {
      const pastTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

      const mockDoses = [
        {
          id: "dose-missed-1",
          status: "unconfirmed",
          scheduled_for: pastTime,
          medications: { name: "Metformin", strength: "500mg" },
        },
      ];

      const elderChain = createMockQueryChain({
        data: { id: ELDER_ID, full_name: "Eleanor Vance", email: "eleanor@careledger.org" },
        error: null,
      });

      const doseLogsChain = createMockQueryChain({
        data: mockDoses,
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "profiles") return elderChain;
        if (table === "dose_logs") return doseLogsChain;
        return createMockQueryChain();
      });

      const res = await fetchCaregiverDashboardDataAction(ELDER_ID);
      expect(res.success).toBe(true);
      expect(res.data?.stats.totalDoses).toBe(1);
      expect(res.data?.stats.takenDoses).toBe(0);
      expect(res.data?.stats.adherenceRate).toBe(0);
      expect(res.data?.stats.adherenceRateDisplay).toBe("0%");
    });
  });

  describe("createMedicationWithScheduleAction", () => {
    it("creates medication prescription and recurring schedule atomically", async () => {
      const createdMed = {
        id: MED_ID,
        elder_id: ELDER_ID,
        name: "Amlodipine",
        strength: "5mg",
        instructions: "Take once daily in the morning",
        status: "active",
      };

      const createdSched = {
        id: "new-sched-1",
        medication_id: MED_ID,
        elder_id: ELDER_ID,
        time_of_day: "morning",
        active: true,
      };

      const medChain = createMockQueryChain({ data: createdMed, error: null });
      const schedChain = createMockQueryChain({ data: createdSched, error: null });
      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "medications") return medChain;
        if (table === "medication_schedules") return schedChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const res = await createMedicationWithScheduleAction(ELDER_ID, {
        medication: {
          name: "Amlodipine",
          strength: "5mg",
          instructions: "Take once daily in the morning",
          status: "active",
        },
        schedule: {
          time_of_day: "morning",
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          dose_amount: "1 pill",
        },
      });

      expect(res.success).toBe(true);
      expect(res.medicationId).toBe(MED_ID);
      expect(auditChain.insert).toHaveBeenCalled();
    });
  });

  describe("claimAlertAction", () => {
    it("updates alert responsibility atomically with caregiver ID", async () => {
      const mockAlert = {
        id: "alert-55",
        elder_id: ELDER_ID,
        status: "open",
      };

      const alertChain = createMockQueryChain();
      // First call: fetch alert
      alertChain.single.mockResolvedValueOnce({ data: mockAlert, error: null });
      // Second call: maybeSingle for update condition
      alertChain.maybeSingle.mockResolvedValueOnce({
        data: {
          ...mockAlert,
          status: "claimed",
          claimed_by: CAREGIVER_ID,
          claimed_at: new Date().toISOString(),
        },
        error: null,
      });

      // Authorization check in care_relationships returns active relationship
      const relChain = createMockQueryChain({
        data: { id: "rel-1", status: "active" },
        error: null,
      });

      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "caregiver_alerts") return alertChain;
        if (table === "care_relationships") return relChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const res = await claimAlertAction("alert-55");
      expect(res.success).toBe(true);
    });
  });

  describe("resolveAlertAction", () => {
    it("resolves alert with caregiver notes and emits audit log when authorized", async () => {
      const mockAlert = {
        id: "alert-55",
        elder_id: ELDER_ID,
        status: "claimed",
        claimed_by: CAREGIVER_ID,
      };

      const alertChain = createMockQueryChain();
      // First call: fetch alert
      alertChain.single
        .mockResolvedValueOnce({ data: mockAlert, error: null })
        .mockResolvedValueOnce({
          data: {
            ...mockAlert,
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_notes: "Called elder, verified dose taken",
          },
          error: null,
        });

      // Authorization check in care_relationships returns active relationship
      const relChain = createMockQueryChain({
        data: { id: "rel-1", status: "active" },
        error: null,
      });

      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "caregiver_alerts") return alertChain;
        if (table === "care_relationships") return relChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const res = await resolveAlertAction("alert-55", "Called elder, verified dose taken");
      expect(res.success).toBe(true);
      expect(auditChain.insert).toHaveBeenCalled();
    });

    it("REGRESSION: Caregiver resolving an alert does NOT mutate dose_logs or increase adherence", async () => {
      const mockAlert = {
        id: "alert-55",
        elder_id: ELDER_ID,
        dose_log_id: "dose-unconfirmed-1",
        status: "claimed",
      };

      const alertChain = createMockQueryChain({ data: mockAlert, error: null });
      const relChain = createMockQueryChain({ data: { id: "rel-1", status: "active" }, error: null });
      const auditChain = createMockQueryChain();
      const doseLogsChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "caregiver_alerts") return alertChain;
        if (table === "care_relationships") return relChain;
        if (table === "audit_logs") return auditChain;
        if (table === "dose_logs") return doseLogsChain;
        return createMockQueryChain();
      });

      const res = await resolveAlertAction("alert-55", "Verified with elder by phone");
      expect(res.success).toBe(true);
      // dose_logs must NEVER be updated by caregiver alert resolution
      expect(doseLogsChain.update).not.toHaveBeenCalled();
    });

    it("rejects resolution when caregiver is not authorized for elder", async () => {
      const mockAlert = {
        id: "alert-99",
        elder_id: "unauthorized-elder-id",
        status: "claimed",
      };

      const alertChain = createMockQueryChain({ data: mockAlert, error: null });
      // Relationship query returns null (not authorized)
      const relChain = createMockQueryChain({ data: null, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "caregiver_alerts") return alertChain;
        if (table === "care_relationships") return relChain;
        return createMockQueryChain();
      });

      const res = await resolveAlertAction("alert-99", "Notes");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });
  });

  describe("fetchLinkedEldersAction", () => {
    it("returns linked elders list for active caregiver", async () => {
      const relChain = createMockQueryChain({
        data: [
          {
            elder_id: ELDER_ID,
            relationship_type: "Mother",
            profiles: {
              id: ELDER_ID,
              full_name: "Eleanor Vance",
              email: "eleanor@careledger.org",
              phone: "555-1234",
            },
          },
        ],
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "care_relationships") return relChain;
        return createMockQueryChain();
      });

      const elders = await fetchLinkedEldersAction();
      expect(elders).toHaveLength(1);
      expect(elders[0].fullName).toBe("Eleanor Vance");
      expect(elders[0].relationshipType).toBe("Mother");
    });
  });
});
