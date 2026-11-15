import { describe, it, expect, vi } from "vitest";
import {
  computeChangedFields,
  formatAuditEntry,
  getElderTimeline,
} from "@/services/timeline-service";

describe("Timeline Service & Audit Log Normalizer", () => {
  describe("computeChangedFields", () => {
    it("returns empty array when both inputs are null or empty", () => {
      expect(computeChangedFields(null, null)).toEqual([]);
      expect(computeChangedFields({}, {})).toEqual([]);
    });

    it("identifies all keys when oldValues is null (create event)", () => {
      const newVals = { name: "Metformin", strength: "500mg" };
      expect(computeChangedFields(null, newVals)).toEqual(["name", "strength"]);
    });

    it("identifies only mutated keys and ignores unmodified values", () => {
      const oldVals = { id: "1", status: "scheduled", notes: "Morning" };
      const newVals = { id: "1", status: "taken", notes: "Morning" };
      expect(computeChangedFields(oldVals, newVals)).toEqual(["status"]);
    });
  });

  describe("formatAuditEntry", () => {
    it("formats dose taken events with affirmative ingestion language", () => {
      const entry = formatAuditEntry({
        action: "update_dose_status",
        entity_type: "dose_log",
        new_values: { status: "taken", medication_name: "Lisinopril", notes: "Took with breakfast" },
      });
      expect(entry.category).toBe("medication");
      expect(entry.title).toBe("Lisinopril Confirmed Taken");
      expect(entry.description).toBe("Took with breakfast");
    });

    it("formats dose unsure events with uncertainty documentation", () => {
      const entry = formatAuditEntry({
        action: "update_dose_status",
        entity_type: "dose_log",
        new_values: { status: "unsure", medication_name: "Metformin" },
      });
      expect(entry.category).toBe("medication");
      expect(entry.title).toBe("Metformin Reported Unsure");
      expect(entry.description).toMatch(/uncertainty/i);
    });

    it("formats overdue unconfirmed dose events", () => {
      const entry = formatAuditEntry({
        action: "escalate_overdue_dose",
        entity_type: "dose_log",
        new_values: { status: "unconfirmed", medication_name: "Atorvastatin" },
      });
      expect(entry.category).toBe("medication");
      expect(entry.title).toBe("Atorvastatin Marked Unconfirmed");
      expect(entry.description).toMatch(/grace period elapsed/i);
    });

    it("formats alert claim and resolution events", () => {
      const claim = formatAuditEntry(
        { action: "claim_alert", entity_type: "caregiver_alert" },
        "Sarah (Caregiver)"
      );
      expect(claim.category).toBe("alert");
      expect(claim.title).toBe("Alert Responsibility Claimed");
      expect(claim.description).toMatch(/Sarah \(Caregiver\) claimed responsibility/);

      const resolve = formatAuditEntry({
        action: "resolve_alert",
        entity_type: "caregiver_alert",
        new_values: { resolution_notes: "Spoke on phone, confirmed pill swallowed." },
      });
      expect(resolve.category).toBe("alert");
      expect(resolve.title).toBe("Escalation Alert Resolved");
      expect(resolve.description).toContain("Spoke on phone");
    });

    it("formats prescription and appointment changes", () => {
      const med = formatAuditEntry({
        action: "create_medication",
        entity_type: "medication",
        new_values: { name: "Amlodipine", strength: "5mg", instructions: "Daily" },
      });
      expect(med.category).toBe("medication");
      expect(med.title).toContain("Amlodipine");

      const appt = formatAuditEntry({
        action: "create_appointment",
        entity_type: "appointment",
        new_values: { title: "Cardiology", provider_name: "Dr. Smith" },
      });
      expect(appt.category).toBe("appointment");
      expect(appt.title).toContain("Cardiology");
    });
  });

  describe("getElderTimeline", () => {
    it("queries audit_logs descending and maps actor profiles and diff fields", async () => {
      const mockRawLogs = [
        {
          id: "log-1",
          created_at: "2026-11-15T10:00:00Z",
          action: "update_dose_status",
          entity_type: "dose_log",
          entity_id: "dose-1",
          actor_role: "elder",
          old_values: { status: "scheduled" },
          new_values: { status: "taken", medication_name: "Lisinopril" },
          profiles: { full_name: "Eleanor Vance" },
        },
      ];

      const mockQueryChain: any = {};
      mockQueryChain.select = vi.fn().mockReturnValue(mockQueryChain);
      mockQueryChain.eq = vi.fn().mockReturnValue(mockQueryChain);
      mockQueryChain.order = vi.fn().mockReturnValue(mockQueryChain);
      mockQueryChain.limit = vi.fn().mockResolvedValue({ data: mockRawLogs, error: null });

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryChain),
      } as any;

      const items = await getElderTimeline(mockSupabase, "elder-123");
      expect(mockSupabase.from).toHaveBeenCalledWith("audit_logs");
      expect(mockQueryChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Lisinopril Confirmed Taken");
      expect(items[0].actorName).toBe("Eleanor Vance");
      expect(items[0].changedFields).toEqual(["status", "medication_name"]);
    });
  });
});
