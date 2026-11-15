import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runEscalationCheck,
  triggerImmediateUnsureEscalation,
} from "@/services/escalation-runner";
import { getDispatchedEmails, clearDispatchedEmails } from "@/services/notification-service";

function createMockQueryChain(defaultResolvedValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(defaultResolvedValue);
  chain.then = (onFulfilled: any) => Promise.resolve(defaultResolvedValue).then(onFulfilled);
  return chain;
}

const ELDER_ID = "00000000-0000-0000-0000-000000000001";
const CAREGIVER_ID = "00000000-0000-0000-0000-000000000002";

describe("Escalation Runner & Caregiver Alerts", () => {
  let mockSupabase: any;

  beforeEach(() => {
    clearDispatchedEmails();
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };
  });

  describe("runEscalationCheck", () => {
    it("escalates doses overdue past 60m grace period and dispatches emails to linked caregivers", async () => {
      const overdueDose = {
        id: "dose-overdue-1",
        status: "scheduled",
        scheduled_for: "2026-11-15T06:00:00.000Z", // 2 hours ago relative to 08:00
        elder_id: ELDER_ID,
        medications: { name: "Metformin", strength: "500mg" },
        profiles: { full_name: "Eleanor Vance" },
      };

      const freshDose = {
        id: "dose-fresh-1",
        status: "scheduled",
        scheduled_for: "2026-11-15T07:45:00.000Z", // 15 mins ago, within 60m grace
        elder_id: ELDER_ID,
        medications: { name: "Lisinopril", strength: "10mg" },
        profiles: { full_name: "Eleanor Vance" },
      };

      const doseLogsChain = createMockQueryChain();
      // Initial list query via in()
      doseLogsChain.in.mockResolvedValueOnce({
        data: [overdueDose, freshDose],
        error: null,
      });

      // recordDoseTransition calls fetch then update for overdue dose
      doseLogsChain.single
        .mockResolvedValueOnce({ data: overdueDose, error: null })
        .mockResolvedValueOnce({
          data: { ...overdueDose, status: "unconfirmed" },
          error: null,
        });

      const careRelChain = createMockQueryChain({
        data: [
          {
            caregiver_id: CAREGIVER_ID,
            profiles: { full_name: "Sarah Vance", email: "sarah.vance@example.org" },
          },
        ],
        error: null,
      });

      const alertChain = createMockQueryChain();
      alertChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      alertChain.single.mockResolvedValueOnce({
        data: { id: "alert-overdue-1", status: "open" },
        error: null,
      });

      const auditChain = createMockQueryChain();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "dose_logs") return doseLogsChain;
        if (table === "care_relationships") return careRelChain;
        if (table === "caregiver_alerts") return alertChain;
        if (table === "audit_logs") return auditChain;
        return createMockQueryChain();
      });

      const currentTime = new Date("2026-11-15T08:00:00.000Z");
      const summary = await runEscalationCheck(mockSupabase, {
        currentTime,
        gracePeriodMinutes: 60,
      });

      expect(summary.evaluated).toBe(2);
      expect(summary.escalated).toBe(1);
      expect(summary.notificationsSent).toBe(1);

      // Verify email was dispatched
      const sentEmails = getDispatchedEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe("sarah.vance@example.org");
      expect(sentEmails[0].subject).toContain("Unconfirmed Scheduled Dose");
    });
  });

  describe("triggerImmediateUnsureEscalation", () => {
    it("immediately emails linked caregivers when elder reports uncertainty", async () => {
      const mockDose = {
        scheduled_for: "2026-11-15T08:00:00.000Z",
        medications: { name: "Lisinopril", strength: "10mg" },
        profiles: { full_name: "Eleanor Vance" },
      };

      const doseLogsChain = createMockQueryChain({ data: mockDose, error: null });
      const careRelChain = createMockQueryChain({
        data: [
          {
            profiles: { full_name: "Sarah Vance", email: "sarah.vance@example.org" },
          },
        ],
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "dose_logs") return doseLogsChain;
        if (table === "care_relationships") return careRelChain;
        return createMockQueryChain();
      });

      const res = await triggerImmediateUnsureEscalation(
        mockSupabase,
        "dose-1",
        ELDER_ID,
        "Patient expressed confusion about pill color"
      );

      expect(res.success).toBe(true);
      expect(res.notificationsSent).toBe(1);

      const sentEmails = getDispatchedEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe("sarah.vance@example.org");
      expect(sentEmails[0].subject).toContain("Unsure Dose Reported");
      expect(sentEmails[0].html).toContain("Patient expressed confusion about pill color");
    });
  });
});
