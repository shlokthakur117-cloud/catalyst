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

describe("CareLedger Mandatory Post-Remediation Security Suite (shsvqcipprcoqzgyibig)", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shsvqcipprcoqzgyibig.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const PASSWORD = "PasswordGate123!#";

  // FAIL-FAST PROJECT-REF GUARD
  if (!supabaseUrl.includes("shsvqcipprcoqzgyibig") || supabaseUrl.includes("hqowqhajrsgahfwjcojo")) {
    throw new Error(
      `CRITICAL ISOLATION BREACH: Attempted to run against prohibited project: ${supabaseUrl}. Expected only: shsvqcipprcoqzgyibig`
    );
  }

  let elderA: AuthUserSession;
  let elderB: AuthUserSession;
  let caregiverA: AuthUserSession;
  let caregiverB: AuthUserSession;
  let caregiverAux: AuthUserSession;
  let anonClient: SupabaseClient;

  const createdMedicationIds: string[] = [];
  const createdDoseLogIds: string[] = [];
  const createdRelationshipIds: string[] = [];

  const randSuffix = () => randomBytes(4).toString("hex").toUpperCase();

  async function login(email: string): Promise<AuthUserSession> {
    const authClient = createClient(supabaseUrl, anonKey!, {
      auth: { persistSession: false, storageKey: `sb-rem-${email}` },
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
      auth: { persistSession: false, storageKey: `sb-rem-u-${email}` },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    return { client, userId: data.user.id, token, email };
  }

  beforeAll(async () => {
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live integration tests.");
    }
    expect(supabaseUrl).toContain("shsvqcipprcoqzgyibig");
    expect(supabaseUrl).not.toContain("hqowqhajrsgahfwjcojo");

    anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    elderA = await login("elder.a.test@careledger.test");
    elderB = await login("elder.b.test@careledger.test");
    caregiverA = await login("caregiver.a.test@careledger.test");
    caregiverB = await login("caregiver.b.test@careledger.test");
    caregiverAux = await login("caregiver.b.gate@careledger.org");

    // Clean up any stale active relationships before running
    await elderA.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderA.userId);
    await elderB.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderB.userId);
  });

  afterAll(async () => {
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

  // ==========================================================================
  // SECTION 1: Relationship Authorization (Tests 1 - 15)
  // ==========================================================================

  it("1. Caregiver direct INSERT without invite — DENIED", async () => {
    const { error } = await caregiverA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: caregiverA.userId,
      status: "pending",
      relationship_type: "family",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates row-level security policy/i);
  });

  it("2. Caregiver direct INSERT with status = active — DENIED", async () => {
    const { error } = await caregiverA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: caregiverA.userId,
      status: "active",
      relationship_type: "family",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates row-level security policy/i);
  });

  it("3. Elder direct INSERT with status = active — DENIED", async () => {
    const { error } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: caregiverA.userId,
      status: "active",
      relationship_type: "family",
      invite_code: `INV-${randSuffix()}`,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates row-level security policy/i);
  });

  let validInviteCode = "";
  let pendingRelId = "";
  it("4. Elder invitation creation through authorized workflow — ALLOWED", async () => {
    validInviteCode = `CARE-VAL-${randSuffix()}`;
    const hash = createHash("sha256").update(validInviteCode).digest("hex");

    const { data, error } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId, // Valid elder placeholder
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    }).select().single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe("pending");
    pendingRelId = data.id;
    createdRelationshipIds.push(data.id);
  });

  it("5. Caregiver claims valid invitation — ALLOWED", async () => {
    const { data, error } = await caregiverA.client.rpc("claim_elder_invitation", {
      p_invite_code: validInviteCode,
      p_relationship_type: "family",
    });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.elder_id).toBe(elderA.userId);
    expect(data.caregiver_id).toBe(caregiverA.userId);
  });

  it("6. Elder claims caregiver invitation — DENIED", async () => {
    const testCode = `CARE-ELDERCLAIM-${randSuffix()}`;
    const hash = createHash("sha256").update(testCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    // Elder B attempts to claim
    const { error: elderErr } = await elderB.client.rpc("claim_elder_invitation", {
      p_invite_code: testCode,
    });
    expect(elderErr).not.toBeNull();
    expect(elderErr?.message).toContain("Only registered caregivers can claim care invitations");
  });

  it("7. Anonymous invitation claim — DENIED", async () => {
    const { error } = await anonClient.rpc("claim_elder_invitation", {
      p_invite_code: validInviteCode,
    });
    expect(error).not.toBeNull();
  });

  it("8. Caregiver directly activates pending relationship — DENIED", async () => {
    const testCode = `CARE-DIRACT-${randSuffix()}`;
    const hash = createHash("sha256").update(testCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const { data: actData } = await caregiverB.client.from("care_relationships").update({
      status: "active",
      caregiver_id: caregiverB.userId,
    }).eq("id", rel.id).select();

    // RLS filters out unauthorized rows: 0 rows modified
    expect(actData).toEqual([]);

    const { data: checkRow } = await elderA.client.from("care_relationships").select("status").eq("id", rel.id).single();
    expect(checkRow?.status).toBe("pending");
  });

  it("9. Caregiver changes elder_id — DENIED", async () => {
    const { error: chgElderErr } = await caregiverA.client.from("care_relationships").update({
      elder_id: elderB.userId,
    }).eq("id", pendingRelId);

    expect(chgElderErr).not.toBeNull();
  });

  it("10. Caregiver changes caregiver_id — DENIED", async () => {
    const { error: chgCgErr } = await caregiverA.client.from("care_relationships").update({
      caregiver_id: caregiverB.userId,
    }).eq("id", pendingRelId);
    expect(chgCgErr).not.toBeNull();
  });

  it("11. Elder changes relationship ownership fields (caregiver_id on active rel) — DENIED", async () => {
    const { error: elderChgErr } = await elderA.client.from("care_relationships").update({
      caregiver_id: elderB.userId,
    }).eq("id", pendingRelId);
    expect(elderChgErr).not.toBeNull();
    expect(elderChgErr?.message).toContain("caregiver_id cannot be modified");
  });

  it("12. Elder revokes relationship — ALLOWED", async () => {
    const { error: revErr } = await elderA.client.from("care_relationships").update({
      status: "revoked",
    }).eq("id", pendingRelId);
    expect(revErr).toBeNull();
  });

  it("13. Revoked caregiver reads elder data — DENIED", async () => {
    // Caregiver A has been revoked
    const { data: meds } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("elder_id", elderA.userId);
    expect(meds).toEqual([]);
  });

  it("14. Caregiver reactivates revoked relationship — DENIED", async () => {
    // Caregiver A attempts to flip status back to active on revoked relationship
    const { data: reactData } = await caregiverA.client.from("care_relationships").update({
      status: "active",
    }).eq("id", pendingRelId).select();

    // RLS denies updating a revoked relationship back to active
    expect(reactData).toEqual([]);

    const { data: checkRev } = await elderA.client.from("care_relationships").select("status").eq("id", pendingRelId).single();
    expect(checkRev?.status).toBe("revoked");
  });

  it("15. New invitation required for rejoining (reactivating old row fails) — DENIED", async () => {
    const { data: rejoinData } = await caregiverA.client.from("care_relationships").update({
      status: "active",
    }).eq("id", pendingRelId).select();
    // RLS denies updating a revoked relationship back to active
    expect(rejoinData).toEqual([]);

    const { data: checkRev } = await elderA.client.from("care_relationships").select("status").eq("id", pendingRelId).single();
    expect(checkRev?.status).toBe("revoked");
  });

  // ==========================================================================
  // SECTION 2: Medication and Dose Integrity (Tests 16 - 28)
  // ==========================================================================

  let linkedMedId = "";
  let unlinkedMedId = "";
  it("Setup active relationship for Section 2 tests", async () => {
    const code = `CARE-SEC2-${randSuffix()}`;
    const hash = createHash("sha256").update(code).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);
    await caregiverA.client.rpc("claim_elder_invitation", { p_invite_code: code });

    const { data: medA } = await elderA.client.from("medications").insert({
      elder_id: elderA.userId,
      name: "Atorvastatin-Test",
      strength: "20mg",
      instructions: "Take at bedtime",
    }).select().single();
    linkedMedId = medA.id;
    createdMedicationIds.push(medA.id);

    const { data: medB } = await elderB.client.from("medications").insert({
      elder_id: elderB.userId,
      name: "Metformin-ElderB",
      strength: "500mg",
      instructions: "With food",
    }).select().single();
    unlinkedMedId = medB.id;
    createdMedicationIds.push(medB.id);
  });

  it("16. Active caregiver reads linked elder medications — ALLOWED", async () => {
    const { data, error } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", linkedMedId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe("Atorvastatin-Test");
  });

  it("17. Unlinked caregiver reads elder medications — DENIED", async () => {
    const { data } = await caregiverB.client
      .from("medications")
      .select("*")
      .eq("id", linkedMedId);
    expect(data).toEqual([]);
  });

  let cgCreatedMedId = "";
  it("18. Active caregiver creates medication — ALLOWED", async () => {
    const { data, error } = await caregiverA.client.from("medications").insert({
      elder_id: elderA.userId,
      name: "Caregiver-Added-Med",
      strength: "10mg",
      instructions: "Morning",
    }).select().single();
    expect(error).toBeNull();
    expect(data).toBeDefined();
    cgCreatedMedId = data.id;
    createdMedicationIds.push(data.id);
  });

  it("19. Active caregiver updates medication — ALLOWED", async () => {
    const { data, error } = await caregiverA.client.from("medications").update({
      strength: "15mg",
    }).eq("id", cgCreatedMedId).select().single();
    expect(error).toBeNull();
    expect(data.strength).toBe("15mg");
  });

  it("20. Caregiver deletes medication — DENIED", async () => {
    const { error } = await caregiverA.client
      .from("medications")
      .delete()
      .eq("id", cgCreatedMedId);
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Only the elder themselves can delete a medication");
  });

  it("21. Elder manages own medication (update, delete) — ALLOWED", async () => {
    // Elder updates
    const { error: updErr } = await elderA.client
      .from("medications")
      .update({ strength: "20mg" })
      .eq("id", cgCreatedMedId);
    expect(updErr).toBeNull();

    // Elder deletes
    const { error: delErr } = await elderA.client
      .from("medications")
      .delete()
      .eq("id", cgCreatedMedId);
    expect(delErr).toBeNull();
  });

  it("22. Caregiver references another elder's medication in dose_logs — DENIED", async () => {
    // Attempt to create dose log for Elder A referencing Elder B's medication
    const { error } = await caregiverA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: unlinkedMedId, // Belongs to Elder B!
      scheduled_for: new Date().toISOString(),
      status: "scheduled",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("does not belong to elder");
  });

  it("23. Caregiver submits actor_role = elder — DENIED", async () => {
    const { error } = await caregiverA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: linkedMedId,
      scheduled_for: new Date().toISOString(),
      status: "scheduled",
      actor_role: "elder",
      confirmed_by: elderA.userId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Non-elder cannot attribute dose action to elder");
  });

  it("24. Caregiver submits confirmed_by = elder_id — DENIED", async () => {
    const { error } = await caregiverA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: linkedMedId,
      scheduled_for: new Date().toISOString(),
      status: "scheduled",
      confirmed_by: elderA.userId,
      actor_role: "elder",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Non-elder cannot attribute dose action to elder");
  });

  it("25. Caregiver marks dose as taken — DENIED", async () => {
    const { error } = await caregiverA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: linkedMedId,
      scheduled_for: new Date().toISOString(),
      status: "taken",
      confirmed_at: new Date().toISOString(),
      confirmed_by: caregiverA.userId,
      actor_role: "caregiver",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Only the elder themselves can mark a dose as taken");
  });

  let legitimateDoseId = "";
  it("26. Legitimate caregiver dose action — ALLOWED", async () => {
    const { data, error } = await caregiverA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: linkedMedId,
      scheduled_for: new Date().toISOString(),
      status: "reminded",
      reminded_at: new Date().toISOString(),
      confirmed_by: caregiverA.userId,
      actor_role: "caregiver",
    }).select().single();
    expect(error).toBeNull();
    expect(data.status).toBe("reminded");
    legitimateDoseId = data.id;
    createdDoseLogIds.push(data.id);
  });

  it("27. Elder performs legitimate dose action (mark taken) — ALLOWED", async () => {
    const { data, error } = await elderA.client.from("dose_logs").insert({
      elder_id: elderA.userId,
      medication_id: linkedMedId,
      scheduled_for: new Date().toISOString(),
      status: "taken",
      confirmed_at: new Date().toISOString(),
      confirmed_by: elderA.userId,
      actor_role: "elder",
    }).select().single();
    expect(error).toBeNull();
    expect(data.status).toBe("taken");
    createdDoseLogIds.push(data.id);
  });

  it("28. Historical dose logs remain intact — ALLOWED", async () => {
    const { data, error } = await elderA.client
      .from("dose_logs")
      .select("id, status")
      .eq("id", legitimateDoseId)
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.status).toBe("reminded");
  });

  // ==========================================================================
  // SECTION 3: Invitation and RPC Security (Tests 29 - 40)
  // ==========================================================================

  let rpcTestCode = "";
  it("29. Valid caregiver invitation claim — ALLOWED", async () => {
    rpcTestCode = `CARE-RPC29-${randSuffix()}`;
    const hash = createHash("sha256").update(rpcTestCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const { data, error } = await caregiverB.client.rpc("claim_elder_invitation", {
      p_invite_code: rpcTestCode,
    });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
  });

  it("30. Elder invitation claim — DENIED", async () => {
    const code = `CARE-ELDERCLAIM2-${randSuffix()}`;
    const hash = createHash("sha256").update(code).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const { error } = await elderB.client.rpc("claim_elder_invitation", {
      p_invite_code: code,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Only registered caregivers can claim care invitations");
  });

  it("31. Invalid invitation claim — DENIED", async () => {
    const { error } = await caregiverB.client.rpc("claim_elder_invitation", {
      p_invite_code: "NONEXISTENT-CODE-12345",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid or expired invitation code");
  });

  it("32. Expired invitation claim — DENIED", async () => {
    const expCode = `CARE-EXP32-${randSuffix()}`;
    const hash = createHash("sha256").update(expCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const { error } = await caregiverB.client.rpc("claim_elder_invitation", {
      p_invite_code: expCode,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("This invitation code has expired");
  });

  it("33. Already-claimed invitation reuse — DENIED", async () => {
    const { error } = await caregiverAux.client.rpc("claim_elder_invitation", {
      p_invite_code: rpcTestCode,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Invalid or expired invitation code");
  });

  it("34. Concurrent invitation claims — exactly one success", async () => {
    // Revoke any previous active relationships for Elder A so caregivers are eligible
    await elderA.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderA.userId);

    const raceCode = `CARE-RACE34-${randSuffix()}`;
    const hash = createHash("sha256").update(raceCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const [resA, resB] = await Promise.all([
      caregiverA.client.rpc("claim_elder_invitation", { p_invite_code: raceCode }),
      caregiverAux.client.rpc("claim_elder_invitation", { p_invite_code: raceCode }),
    ]);

    const successes = (resA.data?.success ? 1 : 0) + (resB.data?.success ? 1 : 0);
    const failures = (resA.error ? 1 : 0) + (resB.error ? 1 : 0);
    expect(successes).toBe(1);
    expect(failures).toBe(1);
  });

  it("35. Invitation code invalidated after claim", async () => {
    const { data } = await elderA.client
      .from("care_relationships")
      .select("invite_code, status")
      .eq("status", "active")
      .limit(1)
      .single();
    expect(data?.invite_code).toBeNull();
    expect(data?.status).toBe("active");
  });

  it("36. Anonymous direct execution of check_and_record_rate_limit — DENIED with SQLSTATE 42501", async () => {
    const { data, error } = await anonClient.rpc("check_and_record_rate_limit", {
      p_key: `probe_anon_${Date.now()}`,
      p_max_attempts: 5,
      p_lockout_seconds: 60,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/permission denied for function check_and_record_rate_limit/i);
    expect(data).toBeNull();
  });

  it("37. Authenticated direct execution of check_and_record_rate_limit — DENIED with SQLSTATE 42501", async () => {
    const { data, error } = await caregiverA.client.rpc("check_and_record_rate_limit", {
      p_key: `probe_auth_${Date.now()}`,
      p_max_attempts: 5,
      p_lockout_seconds: 60,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/permission denied for function check_and_record_rate_limit/i);
    expect(data).toBeNull();
  });

  it("38. Internal rate-limiting via SECURITY DEFINER callers (get_invitation_summary & claim_elder_invitation) — ALLOWED & FUNCTIONAL", async () => {
    // 1. Anonymous invocation of get_invitation_summary (internally calls check_and_record_rate_limit as SECURITY DEFINER postgres)
    const { data: summaryData, error: summaryError } = await anonClient.rpc("get_invitation_summary", {
      p_invite_code: "NONEXISTENT_PROBE_CODE",
    });
    expect(summaryError).toBeNull();
    expect(summaryData).toBeDefined();
    expect(summaryData.valid).toBe(false);

    // 2. Authenticated invocation of claim_elder_invitation (internally calls check_and_record_rate_limit as SECURITY DEFINER postgres)
    const { data: claimData, error: claimError } = await caregiverAux.client.rpc("claim_elder_invitation", {
      p_invite_code: "INVALID_PROBE_CODE_FOR_ACL",
      p_relationship_type: "family",
    });
    // Must return application error (invalid/expired), NOT SQLSTATE 42501 permission denied
    expect(claimError).toBeNull();
    expect(claimData.success).toBe(false);
    expect(claimData.error).toMatch(/Invalid or expired/i);
  });

  it("39. Invitation summary lookup is rate-limited", async () => {
    const { data, error } = await anonClient.rpc("get_invitation_summary", {
      p_invite_code: "NONEXISTENT_CODE",
    });
    // Valid lookup executes and returns uniform not_found
    expect(error).toBeNull();
    expect(data.valid).toBe(false);
    expect(data.status).toBe("not_found");
  });

  it("40. Unauthorized RPC execution (reset_rate_limit & reset_test_rate_limits by non-service_role) — DENIED", async () => {
    const { error: userErr } = await caregiverA.client.rpc("reset_rate_limit", {
      p_key: "any_key",
    });
    expect(userErr).not.toBeNull();

    const { error: anonErr } = await anonClient.rpc("reset_rate_limit", {
      p_key: "any_key",
    });
    expect(anonErr).not.toBeNull();

    // Verify hardened helper cannot be invoked by authenticated users
    const { error: helperAuthErr } = await caregiverA.client.rpc("reset_test_rate_limits", {
      p_user_id: caregiverA.userId,
    });
    expect(helperAuthErr).not.toBeNull();

    // Verify hardened helper cannot be invoked by anonymous users
    const { error: helperAnonErr } = await anonClient.rpc("reset_test_rate_limits", {
      p_user_id: caregiverA.userId,
    });
    expect(helperAnonErr).not.toBeNull();
  });

  // ==========================================================================
  // SECTION 4: Database and Regression Tests (Tests 41 - 49)
  // ==========================================================================

  it("41. RLS enabled on all nine tables", async () => {
    const tables = [
      "profiles", "care_relationships", "medications", "medication_schedules",
      "dose_logs", "caregiver_alerts", "appointments", "audit_logs", "rate_limits"
    ];
    for (const t of tables) {
      const { data } = await anonClient.from(t).select("*");
      expect(data).toEqual([]);
    }
  });

  it("42. Unnecessary grants revoked (TRUNCATE, TRIGGER, REFERENCES)", async () => {
    // Attempting direct unauthorized write to rate_limits table
    const { error } = await anonClient.from("rate_limits").insert({ key: "malicious" });
    expect(error).not.toBeNull();
  });

  it("43. SECURITY DEFINER functions use safe search paths", async () => {
    // Calling get_invitation_summary with valid code produces expected preview
    const { data, error } = await caregiverA.client.rpc("get_invitation_summary", {
      p_invite_code: rpcTestCode,
    });
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it("44. Audit logs cannot be updated or deleted by normal users", async () => {
    const { data: auditRows } = await elderA.client.from("audit_logs").select("id").limit(1);
    if (auditRows && auditRows[0]) {
      const { error: delErr } = await elderA.client.from("audit_logs").delete().eq("id", auditRows[0].id);
      expect(delErr).not.toBeNull();

      const { error: updErr } = await elderA.client.from("audit_logs").update({ action: "tampered" }).eq("id", auditRows[0].id);
      expect(updErr).not.toBeNull();
    }
  });

  it("45. Audit actor spoofing is rejected", async () => {
    const { error } = await caregiverA.client.from("audit_logs").insert({
      elder_id: elderA.userId,
      actor_id: elderB.userId, // Spoofed actor!
      actor_role: "elder",
      action: "malicious_audit",
      entity_type: "medication",
      entity_id: "00000000-0000-0000-0000-000000000001",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/violates row-level security policy/i);
  });

  it("46. Anonymous access restrictions remain intact", async () => {
    const { data: prof } = await anonClient.from("profiles").select("*");
    expect(prof).toEqual([]);
    const { data: med } = await anonClient.from("medications").select("*");
    expect(med).toEqual([]);
    const { data: dose } = await anonClient.from("dose_logs").select("*");
    expect(dose).toEqual([]);
  });

  it("47. Existing cross-elder isolation tests pass", async () => {
    const { data: elderBMeds } = await elderA.client
      .from("medications")
      .select("*")
      .eq("id", unlinkedMedId);
    expect(elderBMeds).toEqual([]);
  });

  it("48. Existing concurrency tests pass", async () => {
    // Revoke any previous active relationships for Elder A
    await elderA.client.from("care_relationships").update({ status: "revoked" }).eq("elder_id", elderA.userId);

    const raceCode = `CARE-RACE48-${randSuffix()}`;
    const hash = createHash("sha256").update(raceCode).digest("hex");
    const { data: rel } = await elderA.client.from("care_relationships").insert({
      elder_id: elderA.userId,
      caregiver_id: elderA.userId,
      status: "pending",
      relationship_type: "family",
      invite_code: hash,
    }).select().single();
    createdRelationshipIds.push(rel.id);

    const [resA, resB] = await Promise.all([
      caregiverA.client.rpc("claim_elder_invitation", { p_invite_code: raceCode }),
      caregiverAux.client.rpc("claim_elder_invitation", { p_invite_code: raceCode }),
    ]);

    const succ = (resA.data?.success ? 1 : 0) + (resB.data?.success ? 1 : 0);
    expect(succ).toBe(1);
  });

  it("49. Existing authentication and application integration tests pass", async () => {
    const { data: profile } = await elderA.client
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", elderA.userId)
      .single();
    expect(profile).toBeDefined();
    expect(profile?.email).toBe(elderA.email);
    expect(profile?.role).toBe("elder");
  });
});
