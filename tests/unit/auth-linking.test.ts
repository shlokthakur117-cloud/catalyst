import { describe, it, expect, beforeEach } from "vitest";
import {
  createElderInvite,
  claimElderInvite,
  verifyCaregiverElderAuthorization,
} from "@/services/relationship-service";
import { recordSuccessfulAttempt } from "@/lib/security";

describe("Plan 01-03: Auth & Elder-Caregiver Role Linking", () => {
  const mockDb: {
    relationships: any[];
    profiles: any[];
  } = {
    relationships: [],
    profiles: [],
  };

  const createMockSupabase = (currentUserId?: string): any => ({
    from: (table: string) => {
      if (table === "care_relationships") {
        return {
          insert: async (record: any) => {
            const saved = { ...record, id: "rel-" + (mockDb.relationships.length + 1) };
            mockDb.relationships.push(saved);
            return { error: null };
          },
          select: (cols: string) => ({
            eq: (col1: string, val1: any) => ({
              eq: (col2: string, val2: any) => ({
                eq: (col3: string, val3: any) => ({
                  maybeSingle: async () => {
                    const found = mockDb.relationships.find(
                      (r) => r[col1] === val1 && r[col2] === val2 && r[col3] === val3
                    );
                    return { data: found || null, error: null };
                  },
                }),
                maybeSingle: async () => {
                  const found = mockDb.relationships.find(
                    (r) => r[col1] === val1 && r[col2] === val2
                  );
                  return { data: found || null, error: null };
                },
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (col: string, val: any) => {
              const idx = mockDb.relationships.findIndex((r) => r[col] === val);
              if (idx !== -1) {
                mockDb.relationships[idx] = { ...mockDb.relationships[idx], ...updates };
                return { error: null };
              }
              return { error: { message: "Record not found" } };
            },
          }),
        };
      }
      return {};
    },
  });

  beforeEach(() => {
    mockDb.relationships = [];
    mockDb.profiles = [];
    recordSuccessfulAttempt("invite_claim:caregiver-1");
  });

  it("elder can generate a secure, 48-hour expiring invitation code", async () => {
    const supabase = createMockSupabase("elder-1");
    const result = await createElderInvite(supabase, "elder-1");

    expect(result.inviteCode).toMatch(/^CARE-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Stored in DB with hashed invite code, not plaintext
    expect(mockDb.relationships).toHaveLength(1);
    expect(mockDb.relationships[0].status).toBe("pending");
    expect(mockDb.relationships[0].invite_code).not.toBe(result.inviteCode); // Hashed!
  });

  it("caregiver claims elder invite: activates relationship and erases invite code for single use", async () => {
    const supabase = createMockSupabase();
    const { inviteCode } = await createElderInvite(supabase, "elder-1");

    const claimResult = await claimElderInvite(supabase, "caregiver-1", inviteCode, "family");
    expect(claimResult.success).toBe(true);
    expect(claimResult.elderId).toBe("elder-1");

    // Relationship updated to active, invite code cleared
    const rel = mockDb.relationships[0];
    expect(rel.status).toBe("active");
    expect(rel.caregiver_id).toBe("caregiver-1");
    expect(rel.invite_code).toBeNull(); // Single-use guarantee!
  });

  it("enforces strict server-side authorization boundaries", async () => {
    const supabase = createMockSupabase();

    // 1. Elder can always access own record
    const selfAccess = await verifyCaregiverElderAuthorization(supabase, "elder-1", "elder-1");
    expect(selfAccess).toBe(true);

    // 2. Unlinked caregiver cannot access elder
    const unlinkedAccess = await verifyCaregiverElderAuthorization(supabase, "caregiver-unlinked", "elder-1");
    expect(unlinkedAccess).toBe(false);

    // 3. Link caregiver and verify authorized access
    mockDb.relationships.push({
      id: "rel-1",
      elder_id: "elder-1",
      caregiver_id: "caregiver-authorized",
      status: "active",
      relationship_type: "family",
    });

    const authorizedAccess = await verifyCaregiverElderAuthorization(
      supabase,
      "caregiver-authorized",
      "elder-1"
    );
    expect(authorizedAccess).toBe(true);

    // 4. Revoked or pending relationship denies access
    mockDb.relationships.push({
      id: "rel-2",
      elder_id: "elder-1",
      caregiver_id: "caregiver-revoked",
      status: "revoked",
      relationship_type: "family",
    });

    const revokedAccess = await verifyCaregiverElderAuthorization(
      supabase,
      "caregiver-revoked",
      "elder-1"
    );
    expect(revokedAccess).toBe(false);
  });
});
