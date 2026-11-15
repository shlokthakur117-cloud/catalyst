import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createElderInvite,
  claimElderInvite,
  getInviteSummary,
  verifyCaregiverElderAuthorization,
} from "@/services/relationship-service";
import {
  generateSecureInviteCode,
  calculateInviteExpiration,
  hashToken,
  recordSuccessfulAttempt,
  checkRateLimit,
} from "@/lib/security";

describe("Phase 3: Authentication, Password Recovery & Onboarding Security", () => {
  let mockDb: {
    relationships: any[];
    profiles: any[];
    auditLogs: any[];
  };

  const createMockSupabase = (currentUserId?: string) => ({
    auth: {
      getUser: async () => ({
        data: {
          user: currentUserId
            ? {
                id: currentUserId,
                email: `${currentUserId}@example.com`,
                user_metadata: { role: "elder", full_name: "Eleanor Vance" },
              }
            : null,
        },
        error: null,
      }),
      resetPasswordForEmail: async (_email: string) => ({ error: null }),
      updateUser: async (_attrs: any) => ({ error: null }),
    },
    from: (table: string) => {
      if (table === "care_relationships") {
        return {
          insert: async (record: any) => {
            const saved = { ...record, id: "rel-" + (mockDb.relationships.length + 1) };
            mockDb.relationships.push(saved);
            return { data: saved, error: null };
          },
          select: (_cols: string) => ({
            eq: (col1: string, val1: any) => ({
              maybeSingle: async () => {
                const found = mockDb.relationships.find((r) => r[col1] === val1);
                return {
                  data: found
                    ? {
                        ...found,
                        profiles: mockDb.profiles.find((p) => p.id === found.elder_id) || {
                          full_name: "Eleanor Vance",
                        },
                      }
                    : null,
                  error: null,
                };
              },
              eq: (col2: string, val2: any) => ({
                maybeSingle: async () => {
                  const found = mockDb.relationships.find(
                    (r) => r[col1] === val1 && r[col2] === val2
                  );
                  return {
                    data: found
                      ? {
                          ...found,
                          profiles: mockDb.profiles.find((p) => p.id === found.elder_id) || {
                            full_name: "Eleanor Vance",
                          },
                        }
                      : null,
                    error: null,
                  };
                },
                eq: (col3: string, val3: any) => ({
                  maybeSingle: async () => {
                    const found = mockDb.relationships.find(
                      (r) => r[col1] === val1 && r[col2] === val2 && r[col3] === val3
                    );
                    return { data: found || null, error: null };
                  },
                }),
              }),
            }),
          }),
          update: (updates: any) => {
            const query: any = {
              eq: (col1: string, val1: any) => {
                let matchedIndex = mockDb.relationships.findIndex((r) => r[col1] === val1);
                const chainedQuery: any = {
                  eq: (col2: string, val2: any) => {
                    const idx = mockDb.relationships.findIndex(
                      (r) => r[col1] === val1 && r[col2] === val2
                    );
                    if (idx !== -1) {
                      mockDb.relationships[idx] = {
                        ...mockDb.relationships[idx],
                        ...updates,
                      };
                      return {
                        select: () => ({
                          maybeSingle: async () => ({
                            data: mockDb.relationships[idx],
                            error: null,
                          }),
                        }),
                      };
                    }
                    return {
                      select: () => ({
                        maybeSingle: async () => ({ data: null, error: null }),
                      }),
                    };
                  },
                };
                if (matchedIndex !== -1) {
                  mockDb.relationships[matchedIndex] = {
                    ...mockDb.relationships[matchedIndex],
                    ...updates,
                  };
                }
                return chainedQuery;
              },
            };
            return query;
          },
        };
      }

      if (table === "profiles") {
        return {
          update: (updates: any) => ({
            eq: async (col: string, val: any) => {
              const idx = mockDb.profiles.findIndex((p) => p[col] === val);
              if (idx !== -1) {
                mockDb.profiles[idx] = { ...mockDb.profiles[idx], ...updates };
              }
              return { error: null };
            },
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: mockDb.profiles[0] || null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "audit_logs") {
        return {
          insert: async (log: any) => {
            mockDb.auditLogs.push(log);
            return { error: null };
          },
        };
      }

      return {};
    },
  });

  beforeEach(() => {
    mockDb = {
      relationships: [],
      profiles: [
        { id: "elder-1", full_name: "Eleanor Vance", role: "elder" },
        { id: "caregiver-1", full_name: "Sarah Vance", role: "caregiver" },
      ],
      auditLogs: [],
    };
    recordSuccessfulAttempt("invite_claim:caregiver-1");
    recordSuccessfulAttempt("invite_claim:caregiver-2");
    recordSuccessfulAttempt("invite_claim:elder-1");
  });

  describe("1. Invitation Token Verification & Metadata Disclosure", () => {
    it("returns non-sensitive summary metadata for pending invite without exposing internal hashes", async () => {
      const supabase = createMockSupabase("elder-1") as any;
      const { inviteCode, expiresAt } = await createElderInvite(supabase, "elder-1");

      const summary = await getInviteSummary(supabase, inviteCode);
      expect(summary.valid).toBe(true);
      expect(summary.status).toBe("pending");
      expect(summary.elderName).toBe("Eleanor Vance");
      expect(summary.relationshipType).toBe("family");
      expect(summary.expiresAt).toBe(expiresAt);
      expect((summary as any).invite_code).toBeUndefined();
    });

    it("returns not_found status for non-existent invite tokens", async () => {
      const supabase = createMockSupabase() as any;
      const summary = await getInviteSummary(supabase, "CARE-INVALID-TOKEN-9999-0000");
      expect(summary.valid).toBe(false);
      expect(summary.status).toBe("not_found");
    });

    it("detects expired invitations and surfaces expiration status", async () => {
      const supabase = createMockSupabase("elder-1") as any;
      const rawCode = "CARE-EXPIRED-CODE-0000-0000";
      const hashed = hashToken(rawCode);

      // Past expiration (3 days ago)
      mockDb.relationships.push({
        id: "rel-expired",
        elder_id: "elder-1",
        caregiver_id: "elder-1",
        status: "pending",
        relationship_type: "family",
        invite_code: hashed,
        expires_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const summary = await getInviteSummary(supabase, rawCode);
      expect(summary.valid).toBe(false);
      expect(summary.status).toBe("expired");
    });
  });

  describe("2. Invitation Claiming Invariants & Single-Use Enforcement", () => {
    it("activates relationship and wipes invite code to guarantee single-use", async () => {
      const supabase = createMockSupabase() as any;
      const { inviteCode } = await createElderInvite(supabase, "elder-1");

      const result = await claimElderInvite(supabase, "caregiver-1", inviteCode, "daughter");
      expect(result.success).toBe(true);
      expect(result.elderId).toBe("elder-1");

      const claimedRel = mockDb.relationships[0];
      expect(claimedRel.status).toBe("active");
      expect(claimedRel.caregiver_id).toBe("caregiver-1");
      expect(claimedRel.invite_code).toBeNull();
      expect(claimedRel.relationship_type).toBe("daughter");
    });

    it("rejects self-claim attempt when elder attempts to claim their own invite", async () => {
      const supabase = createMockSupabase() as any;
      const { inviteCode } = await createElderInvite(supabase, "elder-1");

      await expect(
        claimElderInvite(supabase, "elder-1", inviteCode, "family")
      ).rejects.toThrow("Unauthorized: An elder cannot claim their own care invitation.");
    });

    it("rejects claiming an expired invitation code", async () => {
      const supabase = createMockSupabase() as any;
      const rawCode = "CARE-EXPIRED-TEST-CODE-0001";
      const hashed = hashToken(rawCode);

      mockDb.relationships.push({
        id: "rel-expired-claim",
        elder_id: "elder-1",
        caregiver_id: "elder-1",
        status: "pending",
        relationship_type: "family",
        invite_code: hashed,
        expires_at: new Date(Date.now() - 10000).toISOString(),
      });

      await expect(
        claimElderInvite(supabase, "caregiver-1", rawCode, "family")
      ).rejects.toThrow("This invitation code has expired.");
    });

    it("rejects claiming an invitation that has already been claimed", async () => {
      const supabase = createMockSupabase() as any;
      const { inviteCode } = await createElderInvite(supabase, "elder-1");

      // First claim succeeds
      await claimElderInvite(supabase, "caregiver-1", inviteCode, "family");

      // Second claim with the same code fails
      await expect(
        claimElderInvite(supabase, "caregiver-2", inviteCode, "family")
      ).rejects.toThrow("Invalid or expired invitation code.");
    });
  });

  describe("3. Caregiver Authorization Boundaries", () => {
    it("denies access to an elder's medical records if relationship is unlinked or revoked", async () => {
      const supabase = createMockSupabase() as any;

      // 1. No relationship
      const authorizedNoRel = await verifyCaregiverElderAuthorization(
        supabase,
        "caregiver-unlinked",
        "elder-1"
      );
      expect(authorizedNoRel).toBe(false);

      // 2. Pending relationship (not yet claimed)
      mockDb.relationships.push({
        elder_id: "elder-1",
        caregiver_id: "caregiver-pending",
        status: "pending",
      });
      const authorizedPending = await verifyCaregiverElderAuthorization(
        supabase,
        "caregiver-pending",
        "elder-1"
      );
      expect(authorizedPending).toBe(false);

      // 3. Revoked relationship
      mockDb.relationships.push({
        elder_id: "elder-1",
        caregiver_id: "caregiver-revoked",
        status: "revoked",
      });
      const authorizedRevoked = await verifyCaregiverElderAuthorization(
        supabase,
        "caregiver-revoked",
        "elder-1"
      );
      expect(authorizedRevoked).toBe(false);

      // 4. Active relationship is granted
      mockDb.relationships.push({
        elder_id: "elder-1",
        caregiver_id: "caregiver-active",
        status: "active",
      });
      const authorizedActive = await verifyCaregiverElderAuthorization(
        supabase,
        "caregiver-active",
        "elder-1"
      );
      expect(authorizedActive).toBe(true);
    });

    it("allows elders full access to their own records unconditionally", async () => {
      const supabase = createMockSupabase() as any;
      const isAuthorized = await verifyCaregiverElderAuthorization(
        supabase,
        "elder-1",
        "elder-1"
      );
      expect(isAuthorized).toBe(true);
    });
  });

  describe("4. Security Entropy & Invariants", () => {
    it("generates 128-bit cryptographically secure invitation tokens matching CARE format", () => {
      const code1 = generateSecureInviteCode();
      const code2 = generateSecureInviteCode();

      expect(code1).toMatch(/^CARE-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
      expect(code2).toMatch(/^CARE-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
      expect(code1).not.toBe(code2);
    });

    it("sets invitation expiration to exactly 48 hours from issuance", () => {
      const before = Date.now();
      const expiresAt = calculateInviteExpiration();
      const diffMs = expiresAt.getTime() - before;
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeGreaterThanOrEqual(47.9);
      expect(diffHours).toBeLessThanOrEqual(48.1);
    });
  });
});
