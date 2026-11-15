import { describe, it, expect } from "vitest";
import { persistCaregiverAlert, claimCaregiverAlert } from "@/services/alert-service";

describe("Alert Concurrency & Race-Condition Protections", () => {
  it("prevents duplicate active alerts for the same dose slot in parallel calls", async () => {
    // In-memory mock database store simulating Postgres row-locking
    const activeAlerts: any[] = [];
    let queryCount = 0;

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "caregiver_alerts") {
          return {
            select: () => ({
              eq: (col: string, val: any) => ({
                eq: (col2: string, val2: any) => ({
                  in: (col3: string, vals: any[]) => ({
                    maybeSingle: async () => {
                      queryCount++;
                      // Return existing open alert if present
                      const match = activeAlerts.find(
                        (a) => a.elder_id === val && a.dose_log_id === val2 && vals.includes(a.status)
                      );
                      return { data: match || null, error: null };
                    },
                  }),
                }),
              }),
            }),
            insert: (record: any) => ({
              select: () => ({
                single: async () => {
                  // Simulate unique partial constraint: if another active exists, fail
                  const duplicate = activeAlerts.find(
                    (a) =>
                      a.elder_id === record.elder_id &&
                      a.dose_log_id === record.dose_log_id &&
                      ["open", "claimed"].includes(a.status)
                  );
                  if (duplicate) {
                    return { data: null, error: { message: "duplicate key value violates unique index 'idx_unique_active_dose_alert'" } };
                  }
                  const saved = { ...record, id: "alert-" + (activeAlerts.length + 1), created_at: new Date().toISOString() };
                  activeAlerts.push(saved);
                  return { data: saved, error: null };
                },
              }),
            }),
          };
        }
        if (table === "audit_logs") {
          return { insert: async () => ({ error: null }) };
        }
        return {};
      },
    };

    // First call creates the alert
    const call1 = await persistCaregiverAlert(mockSupabase, {
      elderId: "elder-1",
      doseLogId: "dose-100",
      alertType: "unconfirmed_dose",
      urgency: "high",
    });

    expect(call1.isDuplicate).toBe(false);
    expect(call1.alert.id).toBe("alert-1");

    // Second call for the same dose returns existing without duplication
    const call2 = await persistCaregiverAlert(mockSupabase, {
      elderId: "elder-1",
      doseLogId: "dose-100",
      alertType: "unconfirmed_dose",
      urgency: "high",
    });

    expect(call2.isDuplicate).toBe(true);
    expect(call2.alert.id).toBe("alert-1");
    expect(activeAlerts).toHaveLength(1); // Exact 1 alert preserved
  });

  it("ensures concurrent caregiver claims cannot both succeed (atomic winner)", async () => {
    let alertRecord = {
      id: "alert-1",
      elder_id: "elder-1",
      dose_log_id: "dose-1",
      alert_type: "unsure_dose" as const,
      urgency: "high" as const,
      status: "open",
      claimed_by: null as string | null,
      claimed_at: null as string | null,
      resolved_at: null,
      resolution_notes: null,
      created_at: new Date().toISOString(),
    };

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "caregiver_alerts") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { ...alertRecord }, error: null }),
              }),
            }),
            update: (updates: any) => ({
              eq: (col1: string, val1: any) => ({
                eq: (col2: string, val2: any) => ({
                  select: () => ({
                    maybeSingle: async () => {
                      // Atomic condition check: WHERE status = 'open'
                      if (alertRecord.status !== val2) {
                        return { data: null, error: null }; // 0 rows updated
                      }
                      alertRecord = { ...alertRecord, ...updates };
                      return { data: { ...alertRecord }, error: null };
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "care_relationships") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { status: "active" }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "audit_logs") {
          return { insert: async () => ({ error: null }) };
        }
        return {};
      },
    };

    // First caregiver claims
    const claim1 = await claimCaregiverAlert(mockSupabase, "alert-1", "caregiver-alice");
    expect(claim1.status).toBe("claimed");
    expect(claim1.claimedBy).toBe("caregiver-alice");

    // Second caregiver attempts to claim the same alert concurrently
    await expect(
      claimCaregiverAlert(mockSupabase, "alert-1", "caregiver-bob")
    ).rejects.toThrow(/Conflict: Alert is no longer open/);

    // Winner remains Alice
    expect(alertRecord.claimed_by).toBe("caregiver-alice");
  });
});
