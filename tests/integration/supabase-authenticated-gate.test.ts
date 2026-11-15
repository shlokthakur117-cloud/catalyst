import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile(".env.local");
  } catch {}
}

interface AuthUserSession {
  client: SupabaseClient;
  userId: string;
  token: string;
  email: string;
}

describe("Post-Migration Dedicated Supabase Security & Authorization Gate (shsvqcipprcoqzgyibig)", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shsvqcipprcoqzgyibig.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const PASSWORD = "PasswordGate123!#";

  // FAIL-FAST PROJECT-REF GUARD
  if (!supabaseUrl.includes("shsvqcipprcoqzgyibig") || supabaseUrl.includes("hqowqhajrsgahfwjcojo")) {
    throw new Error(
      `CRITICAL ISOLATION BREACH: Test suite attempted to run against prohibited project: ${supabaseUrl}. Expected dedicated project: shsvqcipprcoqzgyibig`
    );
  }

  let elderA: AuthUserSession;
  let elderB: AuthUserSession;
  let caregiverA: AuthUserSession;
  let caregiverB: AuthUserSession;
  let anonClient: SupabaseClient;

  const createdMedicationIds: string[] = [];
  const createdDoseLogIds: string[] = [];
  const createdRelationshipIds: string[] = [];

  const randSuffix = () => randomBytes(4).toString("hex").toUpperCase();

  async function login(email: string): Promise<AuthUserSession> {
    const authClient = createClient(supabaseUrl, anonKey!, {
      auth: { persistSession: false, storageKey: `sb-gate-auth-${email}` },
    });

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });

    if (error || !data.session?.access_token) {
      throw new Error(`Failed to login ${email}: ${error?.message}`);
    }

    const token = data.session.access_token;
    const client = createClient(supabaseUrl, anonKey!, {
      auth: { persistSession: false, storageKey: `sb-gate-user-${email}` },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    return {
      client,
      userId: data.user.id,
      token,
      email,
    };
  }

  beforeAll(async () => {
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live integration tests.");
    }

    // Double-check fail-fast isolation guard
    expect(supabaseUrl).toContain("shsvqcipprcoqzgyibig");
    expect(supabaseUrl).not.toContain("hqowqhajrsgahfwjcojo");

    // Anonymous client for unauthenticated tests
    anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // Authenticate all 4 real user accounts via GoTrue
    elderA = await login("elder.a.gate@careledger.org");
    elderB = await login("elder.b.gate@careledger.org");
    caregiverA = await login("caregiver.a.gate@careledger.org");
    caregiverB = await login("caregiver.b.gate@careledger.org");

    // Clean up any stale active relationships from previous interrupted runs (soft revoke)
    await elderA.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderA.userId);
    await elderB.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderB.userId);
  });

  afterAll(async () => {
    // Teardown created records safely using owning clients
    if (createdDoseLogIds.length > 0) {
      await elderA.client.from("dose_logs").delete().in("id", createdDoseLogIds);
      await elderB.client.from("dose_logs").delete().in("id", createdDoseLogIds);
    }
    if (createdMedicationIds.length > 0) {
      await elderA.client.from("medications").delete().in("id", createdMedicationIds);
      await elderB.client.from("medications").delete().in("id", createdMedicationIds);
    }
    if (createdRelationshipIds.length > 0) {
      await elderA.client.from("care_relationships").update({ status: "revoked" }).in("id", createdRelationshipIds);
      await elderB.client.from("care_relationships").update({ status: "revoked" }).in("id", createdRelationshipIds);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Elder A reads own profile and medication [ALLOW]
  // --------------------------------------------------------------------------
  it("Scenario 1: Elder A reads own profile and medication [ALLOW]", async () => {
    const { data: profile, error: pErr } = await elderA.client
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", elderA.userId)
      .single();
    expect(pErr).toBeNull();
    expect(profile?.email).toBe(elderA.email);
    expect(profile?.role).toBe("elder");

    const { data: med, error: medErr } = await elderA.client
      .from("medications")
      .insert({
        elder_id: elderA.userId,
        name: "Lisinopril-AuthGate",
        strength: "10mg",
        instructions: "Take once daily in morning",
        status: "active",
      })
      .select()
      .single();
    expect(medErr).toBeNull();
    expect(med).toBeDefined();
    createdMedicationIds.push(med.id);

    const { data: dose, error: doseErr } = await elderA.client
      .from("dose_logs")
      .insert({
        elder_id: elderA.userId,
        medication_id: med.id,
        scheduled_for: new Date().toISOString(),
        status: "scheduled",
      })
      .select()
      .single();
    expect(doseErr).toBeNull();
    expect(dose?.status).toBe("scheduled");
    createdDoseLogIds.push(dose.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Elder B reads Elder A's medication and dose logs [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 2: Elder B reads Elder A's medication and dose logs [DENY]", async () => {
    const medId = createdMedicationIds[0];
    const doseId = createdDoseLogIds[0];

    const { data: medData } = await elderB.client
      .from("medications")
      .select("*")
      .eq("id", medId);
    expect(medData).toEqual([]);

    const { data: doseData } = await elderB.client
      .from("dose_logs")
      .select("*")
      .eq("id", doseId);
    expect(doseData).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Unlinked Caregiver A reads Elder A's data [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 3: Unlinked Caregiver A reads Elder A's data [DENY]", async () => {
    const medId = createdMedicationIds[0];
    const doseId = createdDoseLogIds[0];

    const { data: medData } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medId);
    expect(medData).toEqual([]);

    const { data: doseData } = await caregiverA.client
      .from("dose_logs")
      .select("*")
      .eq("id", doseId);
    expect(doseData).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Caregiver A claims a valid Elder A invitation [ALLOW]
  // --------------------------------------------------------------------------
  let validInviteCode = "";
  let linkedRelationshipId = "";
  it("Scenario 4: Caregiver A claims a valid Elder A invitation [ALLOW]", async () => {
    validInviteCode = `CARE-INV-${randSuffix()}`;
    const hashedCode = createHash("sha256").update(validInviteCode).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const { data: rel, error: relErr } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.userId,
        caregiver_id: elderA.userId,
        relationship_type: "family",
        status: "pending",
        invite_code: hashedCode,
        expires_at: expiresAt,
      })
      .select()
      .single();
    expect(relErr).toBeNull();
    expect(rel).toBeDefined();
    linkedRelationshipId = rel.id;
    createdRelationshipIds.push(rel.id);

    // Summary RPC check
    const { data: summary, error: sumErr } = await caregiverA.client
      .rpc("get_invitation_summary", { p_invite_code: validInviteCode });
    expect(sumErr).toBeNull();
    expect(summary.valid).toBe(true);
    expect(summary.elder_name).toContain("Elder Alice");

    // Claim RPC
    const { data: claim, error: claimErr } = await caregiverA.client
      .rpc("claim_elder_invitation", {
        p_invite_code: validInviteCode,
        p_relationship_type: "family",
      });
    expect(claimErr).toBeNull();
    expect(claim.success).toBe(true);
    expect(claim.elder_id).toBe(elderA.userId);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Linked Caregiver A reads Elder A's permitted data [ALLOW]
  // --------------------------------------------------------------------------
  it("Scenario 5: Linked Caregiver A reads Elder A's permitted data [ALLOW]", async () => {
    const { data: linkedMed } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", createdMedicationIds[0]);
    expect(linkedMed).not.toBeNull();
    expect(linkedMed).toHaveLength(1);
    expect(linkedMed![0].name).toBe("Lisinopril-AuthGate");

    const { data: linkedDose } = await caregiverA.client
      .from("dose_logs")
      .select("*")
      .eq("id", createdDoseLogIds[0]);
    expect(linkedDose).not.toBeNull();
    expect(linkedDose).toHaveLength(1);
    expect(linkedDose![0].id).toBe(createdDoseLogIds[0]);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Caregiver A reads unrelated Elder B's data [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 6: Caregiver A reads unrelated Elder B's data [DENY]", async () => {
    const { data: medB, error: medBErr } = await elderB.client
      .from("medications")
      .insert({
        elder_id: elderB.userId,
        name: "Metformin-ElderB-AuthGate",
        strength: "500mg",
        instructions: "Take with meal",
        status: "active",
      })
      .select()
      .single();
    expect(medBErr).toBeNull();
    createdMedicationIds.push(medB.id);

    const { data: unlinkedMed } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medB.id);
    expect(unlinkedMed).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Caregiver B reads Caregiver A's private profile [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 7: Caregiver B reads Caregiver A's private profile [DENY]", async () => {
    const { data: cgAProfile } = await caregiverB.client
      .from("profiles")
      .select("*")
      .eq("id", caregiverA.userId);
    expect(cgAProfile).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Caregiver attempts to mark Elder A's dose as 'taken' [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 8: Caregiver attempts to mark Elder A's dose as 'taken' [DENY]", async () => {
    const doseId = createdDoseLogIds[0];

    // Path A: Direct UPDATE attempt to mark as taken
    const { error: updateErr } = await caregiverA.client
      .from("dose_logs")
      .update({
        status: "taken",
        confirmed_at: new Date().toISOString(),
        confirmed_by: caregiverA.userId,
        actor_role: "caregiver",
      })
      .eq("id", doseId);

    expect(updateErr).not.toBeNull();
    expect(updateErr?.message).toContain("Only the elder themselves can mark a dose as taken");

    // Path B: Direct INSERT attempt to insert taken dose as caregiver
    const { error: insertErr } = await caregiverA.client
      .from("dose_logs")
      .insert({
        elder_id: elderA.userId,
        medication_id: createdMedicationIds[0],
        scheduled_for: new Date().toISOString(),
        status: "taken",
        confirmed_at: new Date().toISOString(),
        confirmed_by: caregiverA.userId,
        actor_role: "caregiver",
      });

    expect(insertErr).not.toBeNull();
    expect(insertErr?.message).toContain("Only the elder themselves can mark a dose as taken");

    // Path C: Spoofing attempt with actor_role = 'elder' but authenticated as caregiver
    const { error: spoofErr } = await caregiverA.client
      .from("dose_logs")
      .insert({
        elder_id: elderA.userId,
        medication_id: createdMedicationIds[0],
        scheduled_for: new Date().toISOString(),
        status: "taken",
        confirmed_by: elderA.userId,
        actor_role: "elder",
      });

    expect(spoofErr).not.toBeNull();
    expect(spoofErr?.message).toContain("Only the elder themselves can mark a dose as taken");
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Elder A revokes Caregiver A's relationship [ALLOW]
  // --------------------------------------------------------------------------
  it("Scenario 9: Elder A revokes Caregiver A's relationship [ALLOW]", async () => {
    const { error: revokeErr } = await elderA.client
      .from("care_relationships")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkedRelationshipId);
    expect(revokeErr).toBeNull();

    // Verify row status is revoked
    const { data: relRow } = await elderA.client
      .from("care_relationships")
      .select("status")
      .eq("id", linkedRelationshipId)
      .single();
    expect(relRow?.status).toBe("revoked");
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Revoked Caregiver A reads Elder A's data [DENY immediately]
  // --------------------------------------------------------------------------
  it("Scenario 10: Revoked Caregiver A reads Elder A's data [DENY immediately]", async () => {
    const { data: postRevokeMed } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", createdMedicationIds[0]);
    expect(postRevokeMed).toEqual([]);

    const { data: postRevokeDose } = await caregiverA.client
      .from("dose_logs")
      .select("*")
      .eq("id", createdDoseLogIds[0]);
    expect(postRevokeDose).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Two caregivers concurrently claim one invitation [Exactly one succeeds]
  // --------------------------------------------------------------------------
  let concurrentCode = "";
  it("Scenario 11: Two caregivers concurrently claim one invitation [Exactly one succeeds]", async () => {
    concurrentCode = `CARE-RACE-${randSuffix()}`;
    const concurrentHash = createHash("sha256").update(concurrentCode).digest("hex");

    const { data: raceRel, error: raceErr } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.userId,
        caregiver_id: elderA.userId,
        relationship_type: "family",
        status: "pending",
        invite_code: concurrentHash,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select()
      .single();
    expect(raceErr).toBeNull();
    createdRelationshipIds.push(raceRel.id);

    // Concurrent claim by Caregiver A and Caregiver B in parallel
    const [resA, resB] = await Promise.all([
      caregiverA.client.rpc("claim_elder_invitation", { p_invite_code: concurrentCode, p_relationship_type: "family" }),
      caregiverB.client.rpc("claim_elder_invitation", { p_invite_code: concurrentCode, p_relationship_type: "nurse" }),
    ]);

    const successCount = (resA.data?.success ? 1 : 0) + (resB.data?.success ? 1 : 0);
    const failureCount = (resA.error ? 1 : 0) + (resB.error ? 1 : 0);

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Verify atomic single-use: invite_code is wiped to null in database
    const { data: activeRow } = await elderA.client
      .from("care_relationships")
      .select("id, status, invite_code")
      .eq("id", raceRel.id)
      .single();
    expect(activeRow).not.toBeNull();
    expect(activeRow!.status).toBe("active");
    expect(activeRow!.invite_code).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Invitation code is reused after successful claim [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 12: Invitation code is reused after successful claim [DENY]", async () => {
    // Attempting to claim the concurrent code that was already claimed in Scenario 11
    const { data, error } = await caregiverA.client
      .rpc("claim_elder_invitation", { p_invite_code: concurrentCode, p_relationship_type: "family" });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid or expired invitation code");
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Elder attempts to claim own invitation [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 13: Elder attempts to claim own invitation [DENY]", async () => {
    const selfCode = `CARE-SELF-${randSuffix()}`;
    const selfHash = createHash("sha256").update(selfCode).digest("hex");
    const { data: selfRel, error: insErr } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.userId,
        caregiver_id: elderA.userId,
        relationship_type: "family",
        status: "pending",
        invite_code: selfHash,
      })
      .select()
      .single();
    expect(insErr).toBeNull();
    expect(selfRel).toBeDefined();

    const { error: selfErr } = await elderA.client
      .rpc("claim_elder_invitation", { p_invite_code: selfCode });
    expect(selfErr).not.toBeNull();
    expect(selfErr?.message).toContain("An elder cannot claim their own care invitation");

    // Revoke self-claim invite
    await elderA.client.from("care_relationships").update({ status: "revoked" }).eq("id", selfRel.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Expired invitation is claimed [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 14: Expired invitation is claimed [DENY]", async () => {
    const expiredCode = `CARE-EXPD-${randSuffix()}`;
    const expiredHash = createHash("sha256").update(expiredCode).digest("hex");
    const { data: expRel } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.userId,
        caregiver_id: elderA.userId,
        relationship_type: "family",
        status: "pending",
        invite_code: expiredHash,
        expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      })
      .select()
      .single();
    expect(expRel).toBeDefined();
    createdRelationshipIds.push(expRel.id);

    const { error: expErr } = await caregiverB.client
      .rpc("claim_elder_invitation", { p_invite_code: expiredCode });
    expect(expErr).not.toBeNull();
    expect(expErr?.message).toContain("This invitation code has expired");
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Already-claimed invitation is claimed again [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 15: Already-claimed invitation is claimed again [DENY]", async () => {
    // Caregiver B attempts to re-claim the code from Scenario 4 which was claimed by Caregiver A
    const { data, error } = await caregiverB.client
      .rpc("claim_elder_invitation", {
        p_invite_code: validInviteCode,
        p_relationship_type: "nurse",
      });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid or expired invitation code");
  });

  // --------------------------------------------------------------------------
  // Scenario 16: Anonymous user attempts restricted table access [DENY]
  // --------------------------------------------------------------------------
  it("Scenario 16: Anonymous user attempts restricted table access [DENY]", async () => {
    // Read protection
    const { data: profData } = await anonClient.from("profiles").select("*");
    expect(profData).toEqual([]);

    const { data: medData } = await anonClient.from("medications").select("*");
    expect(medData).toEqual([]);

    const { data: doseData } = await anonClient.from("dose_logs").select("*");
    expect(doseData).toEqual([]);

    const { data: rlData } = await anonClient.from("rate_limits").select("*");
    expect(rlData).toEqual([]);

    // Write protection
    const { error: profInsErr } = await anonClient.from("profiles").insert({
      id: "00000000-0000-0000-0000-000000000099",
      role: "elder",
      full_name: "Anonymous Attacker",
      email: "anon@attacker.org",
    });
    expect(profInsErr).not.toBeNull();
    expect(profInsErr?.message).toMatch(/violates row-level security policy/i);

    const { error: medInsErr } = await anonClient.from("medications").insert({
      elder_id: elderA.userId,
      name: "Malicious Med",
      strength: "1000mg",
      instructions: "Unauthorized",
    });
    expect(medInsErr).not.toBeNull();
    expect(medInsErr?.message).toMatch(/violates row-level security policy/i);
  });
});
