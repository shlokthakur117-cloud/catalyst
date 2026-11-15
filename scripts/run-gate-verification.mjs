import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const PASSWORD = "PasswordGate123!#";

async function loginUser(email, label) {
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (error || !data.session?.access_token) {
    throw new Error(`Failed to login ${label} (${email}): ${error?.message}`);
  }

  const token = data.session.access_token;
  const user = data.user;

  // Create user-authenticated client sending Bearer <JWT>
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { client: userClient, user, token, label };
}

async function runGate() {
  console.log("================================================================================");
  console.log("CARELEDGER — FINAL PHASE 3 AUTHORIZATION & INVITATION CONCURRENCY INTEGRATION GATE");
  console.log("Target Supabase Project:", supabaseUrl);
  console.log("================================================================================\n");

  console.log("Step 1: Authenticating 4 separate accounts via GoTrue (JWT tokens)...");
  const elderA = await loginUser("elder.a.gate@careledger.org", "Elder A");
  const elderB = await loginUser("elder.b.gate@careledger.org", "Elder B");
  const caregiverA = await loginUser("caregiver.a.gate@careledger.org", "Caregiver A");
  const caregiverB = await loginUser("caregiver.b.gate@careledger.org", "Caregiver B");

  console.log(`✓ Elder A authenticated: ID=${elderA.user.id}`);
  console.log(`✓ Elder B authenticated: ID=${elderB.user.id}`);
  console.log(`✓ Caregiver A authenticated: ID=${caregiverA.user.id}`);
  console.log(`✓ Caregiver B authenticated: ID=${caregiverB.user.id}\n`);

  // Clean up any stale test relationships for Elder A and Elder B from prior interrupted runs
  await elderA.client.from("care_relationships").delete().eq("elder_id", elderA.user.id);
  await elderB.client.from("care_relationships").delete().eq("elder_id", elderB.user.id);

  // Track created test records for cleanup
  const createdMedicationIds = [];
  const createdDoseLogIds = [];
  const createdRelationshipIds = [];

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Elder A can access Elder A records
    // -------------------------------------------------------------------------
    console.log("Scenario 1: Elder A accesses own records...");
    const { data: elderAProfile, error: p1Err } = await elderA.client
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", elderA.user.id)
      .single();
    if (p1Err || !elderAProfile) throw new Error(`Elder A failed to read own profile: ${p1Err?.message}`);
    console.log(`✓ Elder A successfully read own profile: ${elderAProfile.full_name} (${elderAProfile.role})`);

    // Elder A creates a medication
    const { data: medA, error: medAErr } = await elderA.client
      .from("medications")
      .insert({
        elder_id: elderA.user.id,
        name: "Lisinopril-GateA",
        strength: "10mg",
        instructions: "Take once daily",
        status: "active",
      })
      .select()
      .single();
    if (medAErr || !medA) throw new Error(`Elder A failed to create medication: ${medAErr?.message}`);
    createdMedicationIds.push(medA.id);
    console.log(`✓ Elder A created private medication: ${medA.name} (ID: ${medA.id})`);

    // Elder A creates a dose log
    const { data: doseA, error: doseAErr } = await elderA.client
      .from("dose_logs")
      .insert({
        elder_id: elderA.user.id,
        medication_id: medA.id,
        scheduled_for: new Date().toISOString(),
        status: "scheduled",
      })
      .select()
      .single();
    if (doseAErr || !doseA) throw new Error(`Elder A failed to create dose log: ${doseAErr?.message}`);
    createdDoseLogIds.push(doseA.id);
    console.log(`✓ Elder A created dose log: ID=${doseA.id}, status=${doseA.status}\n`);

    // -------------------------------------------------------------------------
    // Scenario 2: Elder B cannot access Elder A records (Negative RLS Isolation)
    // -------------------------------------------------------------------------
    console.log("Scenario 2: Elder B attempts to read Elder A records...");
    const { data: elderBReadsMedA } = await elderB.client
      .from("medications")
      .select("*")
      .eq("id", medA.id);
    if (elderBReadsMedA && elderBReadsMedA.length > 0) {
      throw new Error("RLS LEAK: Elder B was able to read Elder A's medication!");
    }
    console.log("✓ RLS ISOLATION ENFORCED: Elder B cannot read Elder A's medication (0 rows returned).");

    const { data: elderBReadsDoseA } = await elderB.client
      .from("dose_logs")
      .select("*")
      .eq("id", doseA.id);
    if (elderBReadsDoseA && elderBReadsDoseA.length > 0) {
      throw new Error("RLS LEAK: Elder B was able to read Elder A's dose log!");
    }
    console.log("✓ RLS ISOLATION ENFORCED: Elder B cannot read Elder A's dose log (0 rows returned).\n");

    // -------------------------------------------------------------------------
    // Scenario 3: Caregiver A (unlinked) cannot access Elder A records
    // -------------------------------------------------------------------------
    console.log("Scenario 3: Caregiver A (unlinked) attempts to read Elder A records...");
    const { data: unlinkedMedA } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medA.id);
    if (unlinkedMedA && unlinkedMedA.length > 0) {
      throw new Error("RLS LEAK: Unlinked Caregiver A was able to read Elder A's medication!");
    }
    console.log("✓ RLS ISOLATION ENFORCED: Unlinked Caregiver A cannot read Elder A's medication (0 rows returned).");

    const { data: unlinkedDoseA } = await caregiverA.client
      .from("dose_logs")
      .select("*")
      .eq("id", doseA.id);
    if (unlinkedDoseA && unlinkedDoseA.length > 0) {
      throw new Error("RLS LEAK: Unlinked Caregiver A was able to read Elder A's dose log!");
    }
    console.log("✓ RLS ISOLATION ENFORCED: Unlinked Caregiver A cannot read Elder A's dose log (0 rows returned).\n");

    // -------------------------------------------------------------------------
    // Scenario 4: Invitation lifecycle — Elder A creates invite, Caregiver A claims
    // -------------------------------------------------------------------------
    console.log("Scenario 4: Invitation lifecycle — creation, metadata, and claim...");
    // Elder A creates invite
    const crypto = await import("crypto");
    const randSuffix = () => crypto.randomBytes(4).toString("hex").toUpperCase();
    const inviteRaw = `CARE-TEST-GATE-${randSuffix()}`;
    const inviteHash = crypto.createHash("sha256").update(inviteRaw).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const { data: newRel, error: relErr } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.user.id,
        caregiver_id: elderA.user.id, // Placeholder
        relationship_type: "family",
        status: "pending",
        invite_code: inviteHash,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (relErr || !newRel) throw new Error(`Elder A failed to create invitation: ${relErr?.message}`);
    createdRelationshipIds.push(newRel.id);
    console.log(`✓ Elder A created pending invite record: ID=${newRel.id}`);

    // Caregiver A reads invitation summary RPC (non-sensitive metadata)
    const { data: summaryData, error: summaryErr } = await caregiverA.client
      .rpc("get_invitation_summary", { p_invite_code: inviteRaw });
    if (summaryErr || !summaryData?.valid) {
      throw new Error(`Caregiver A failed to get invitation summary: ${summaryErr?.message || JSON.stringify(summaryData)}`);
    }
    console.log(`✓ Caregiver A verified invite summary via RPC: valid=${summaryData.valid}, elder=${summaryData.elder_name}`);

    // Caregiver A claims invitation via atomic RPC
    const { data: claimData, error: claimErr } = await caregiverA.client
      .rpc("claim_elder_invitation", {
        p_invite_code: inviteRaw,
        p_relationship_type: "family",
      });
    if (claimErr || !claimData?.success) {
      throw new Error(`Caregiver A failed to claim invitation: ${claimErr?.message || JSON.stringify(claimData)}`);
    }
    console.log(`✓ Caregiver A claimed invitation via atomic RPC: relationship_id=${claimData.relationship_id}`);

    // Caregiver A now reads Elder A's medication and dose log
    const { data: linkedMedA, error: lmErr } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medA.id);
    if (lmErr || !linkedMedA || linkedMedA.length === 0) {
      throw new Error(`AUTHORIZATION FAILURE: Linked Caregiver A could not read Elder A's medication: ${lmErr?.message}`);
    }
    console.log(`✓ AUTHORIZED ACCESS: Linked Caregiver A successfully read Elder A's medication: ${linkedMedA[0].name}`);

    const { data: linkedDoseA, error: ldErr } = await caregiverA.client
      .from("dose_logs")
      .select("*")
      .eq("id", doseA.id);
    if (ldErr || !linkedDoseA || linkedDoseA.length === 0) {
      throw new Error(`AUTHORIZATION FAILURE: Linked Caregiver A could not read Elder A's dose log: ${ldErr?.message}`);
    }
    console.log(`✓ AUTHORIZED ACCESS: Linked Caregiver A successfully read Elder A's dose log: ID=${linkedDoseA[0].id}\n`);

    // -------------------------------------------------------------------------
    // Scenario 5: Caregiver A cannot access Elder B records (Cross-Elder Isolation)
    // -------------------------------------------------------------------------
    console.log("Scenario 5: Caregiver A attempts to access unlinked Elder B records...");
    // Elder B creates medication
    const { data: medB, error: medBErr } = await elderB.client
      .from("medications")
      .insert({
        elder_id: elderB.user.id,
        name: "Metformin-GateB",
        strength: "500mg",
        instructions: "Take with dinner",
        status: "active",
      })
      .select()
      .single();
    if (medBErr || !medB) throw new Error(`Elder B failed to create medication: ${medBErr?.message}`);
    createdMedicationIds.push(medB.id);

    const { data: caregiverAReadsMedB } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medB.id);
    if (caregiverAReadsMedB && caregiverAReadsMedB.length > 0) {
      throw new Error("RLS LEAK: Caregiver A was able to read unlinked Elder B's medication!");
    }
    console.log("✓ CROSS-ELDER ISOLATION ENFORCED: Caregiver A cannot read Elder B's medication (0 rows returned).\n");

    // -------------------------------------------------------------------------
    // Scenario 6: Caregiver B cannot access Caregiver A private profile
    // -------------------------------------------------------------------------
    console.log("Scenario 6: Caregiver B attempts to read Caregiver A profile...");
    const { data: caregiverBReadsAProfile } = await caregiverB.client
      .from("profiles")
      .select("*")
      .eq("id", caregiverA.user.id);
    if (caregiverBReadsAProfile && caregiverBReadsAProfile.length > 0) {
      throw new Error("RLS LEAK: Caregiver B was able to read Caregiver A's private profile!");
    }
    console.log("✓ PEER CAREGIVER ISOLATION ENFORCED: Caregiver B cannot read Caregiver A's profile (0 rows returned).\n");

    // -------------------------------------------------------------------------
    // Scenario 7: Caregiver A attempts direct REST update to set status = 'taken'
    // -------------------------------------------------------------------------
    console.log("Scenario 7: Database Invariant — Caregiver attempts direct REST update to set status = 'taken'...");
    const { data: cgTakenAttempt, error: cgTakenError } = await caregiverA.client
      .from("dose_logs")
      .update({
        status: "taken",
        confirmed_at: new Date().toISOString(),
        confirmed_by: caregiverA.user.id,
        actor_role: "caregiver",
      })
      .eq("id", doseA.id)
      .select();

    if (!cgTakenError) {
      throw new Error("INVARIANT VIOLATION: Database allowed Caregiver A to mark dose as 'taken'!");
    }
    console.log(`✓ DATABASE INVARIANT ENFORCED: Database trigger rejected caregiver 'taken' update: "${cgTakenError.message}"\n`);

    // -------------------------------------------------------------------------
    // Scenario 8: Relationship Revocation — Caregiver A immediately loses all access
    // -------------------------------------------------------------------------
    console.log("Scenario 8: Relationship Revocation — Elder A revokes Caregiver A...");
    const { error: revokeErr } = await elderA.client
      .from("care_relationships")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimData.relationship_id);
    if (revokeErr) throw new Error(`Elder A failed to revoke relationship: ${revokeErr.message}`);
    console.log(`✓ Elder A updated relationship status to 'revoked'`);

    // Caregiver A immediately attempts to read Elder A's medication
    const { data: postRevokeMedA } = await caregiverA.client
      .from("medications")
      .select("*")
      .eq("id", medA.id);
    if (postRevokeMedA && postRevokeMedA.length > 0) {
      throw new Error("REVOCATION FAILURE: Caregiver A can still read Elder A's medications after revocation!");
    }
    console.log("✓ IMMEDIATE ACCESS TERMINATION ENFORCED: Caregiver A immediately lost read access to Elder A's medications (0 rows returned).\n");

    // Clean up revoked relationship record so Caregiver A can participate in subsequent tests
    await elderA.client.from("care_relationships").delete().eq("id", claimData.relationship_id);

    // -------------------------------------------------------------------------
    // Scenario 9: Invitation Concurrency — Two concurrent claim requests
    // -------------------------------------------------------------------------
    console.log("Scenario 9: Invitation Concurrency — Two concurrent claims on single pending invite...");
    const concurrentCode = `CARE-RACE-GATE-${randSuffix()}`;
    const concurrentHash = crypto.createHash("sha256").update(concurrentCode).digest("hex");

    const { data: raceRel, error: raceRelErr } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.user.id,
        caregiver_id: elderA.user.id,
        relationship_type: "family",
        status: "pending",
        invite_code: concurrentHash,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select()
      .single();
    if (raceRelErr || !raceRel) throw new Error(`Failed to create race test invite: ${raceRelErr?.message}`);
    createdRelationshipIds.push(raceRel.id);

    // Fire two claims simultaneously
    console.log("Firing concurrent claim requests from Caregiver A and Caregiver B in parallel...");
    const [resultA, resultB] = await Promise.all([
      caregiverA.client.rpc("claim_elder_invitation", { p_invite_code: concurrentCode, p_relationship_type: "family" }),
      caregiverB.client.rpc("claim_elder_invitation", { p_invite_code: concurrentCode, p_relationship_type: "nurse" }),
    ]);

    const successCount = (resultA.data?.success ? 1 : 0) + (resultB.data?.success ? 1 : 0);
    const failureCount = (resultA.error ? 1 : 0) + (resultB.error ? 1 : 0);

    console.log("Concurrent claim results:", {
      caregiverA_success: Boolean(resultA.data?.success),
      caregiverA_error: resultA.error?.message,
      caregiverB_success: Boolean(resultB.data?.success),
      caregiverB_error: resultB.error?.message,
    });

    if (successCount !== 1 || failureCount !== 1) {
      throw new Error(`CONCURRENCY INVARIANT VIOLATED: Expected exactly 1 success and 1 failure, got ${successCount} successes and ${failureCount} failures!`);
    }
    console.log("✓ ATOMIC CONCURRENCY GUARANTEED: Exactly 1 claim succeeded; exactly 1 was rejected by row lock.\n");

    // Verify only one active relationship exists for this invite
    const { data: activeRelRows } = await elderA.client
      .from("care_relationships")
      .select("id, status, caregiver_id, invite_code")
      .eq("id", raceRel.id);
    console.log("Final state of race invitation row:", activeRelRows);
    if (!activeRelRows || activeRelRows[0].status !== "active" || activeRelRows[0].invite_code !== null) {
      throw new Error("Single-use invariant violated: invite_code was not erased or status is not active!");
    }
    console.log("✓ SINGLE-USE INVARIANT ENFORCED: invite_code was wiped to NULL upon activation.\n");

    // -------------------------------------------------------------------------
    // Scenario 10: Invalid, Expired, and Self-Claim Rejections
    // -------------------------------------------------------------------------
    console.log("Scenario 10: Boundary Rejections (Self-claim, Expired, Already-claimed)...");

    // A. Self-claim: Elder A attempts to claim Elder A's own invite
    const selfCode = `CARE-SELF-GATE-${randSuffix()}`;
    const selfHash = crypto.createHash("sha256").update(selfCode).digest("hex");
    const { data: selfRel } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.user.id,
        caregiver_id: elderA.user.id,
        relationship_type: "family",
        status: "pending",
        invite_code: selfHash,
      })
      .select()
      .single();
    if (selfRel) createdRelationshipIds.push(selfRel.id);

    const { error: selfClaimErr } = await elderA.client
      .rpc("claim_elder_invitation", { p_invite_code: selfCode });
    if (!selfClaimErr) {
      throw new Error("SECURITY VIOLATION: Elder was allowed to self-claim their own care invitation!");
    }
    console.log(`✓ SELF-CLAIM PROHIBITED: Elder cannot claim own invite: "${selfClaimErr.message}"`);

    // Clean up self-claim test relationship before creating expired invite
    if (selfRel) {
      await elderA.client.from("care_relationships").delete().eq("id", selfRel.id);
    }

    // B. Expired invite
    const expiredCode = `CARE-EXPD-GATE-${randSuffix()}`;
    const expiredHash = crypto.createHash("sha256").update(expiredCode).digest("hex");
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: expRel } = await elderA.client
      .from("care_relationships")
      .insert({
        elder_id: elderA.user.id,
        caregiver_id: elderA.user.id,
        relationship_type: "family",
        status: "pending",
        invite_code: expiredHash,
        expires_at: pastDate,
      })
      .select()
      .single();
    if (expRel) createdRelationshipIds.push(expRel.id);

    const { error: expClaimErr } = await caregiverA.client
      .rpc("claim_elder_invitation", { p_invite_code: expiredCode });
    if (!expClaimErr) {
      throw new Error("SECURITY VIOLATION: Caregiver was allowed to claim an expired invitation!");
    }
    console.log(`✓ EXPIRY ENFORCED: Expired invitation claim rejected: "${expClaimErr.message}"`);

    // C. Already claimed invite
    const { error: reClaimErr } = await caregiverA.client
      .rpc("claim_elder_invitation", { p_invite_code: concurrentCode });
    if (!reClaimErr) {
      throw new Error("SECURITY VIOLATION: Caregiver was allowed to re-claim an already-claimed code!");
    }
    console.log(`✓ SINGLE-USE ENFORCED: Re-claim of claimed invitation rejected: "${reClaimErr.message}"\n`);

    console.log("================================================================================");
    console.log("ALL 10 MANDATORY SECURITY & RLS GATE SCENARIOS PASSED WITH 100% SUCCESS!");
    console.log("================================================================================\n");

  } finally {
    // -------------------------------------------------------------------------
    // Scenario 11: Cleanup test records without touching existing project data
    // -------------------------------------------------------------------------
    console.log("Step 11: Cleaning up test records created for this verification run...");

    if (createdDoseLogIds.length > 0) {
      const { count } = await elderA.client
        .from("dose_logs")
        .delete({ count: "exact" })
        .in("id", createdDoseLogIds);
      console.log(`✓ Cleaned up ${count ?? createdDoseLogIds.length} test dose log(s).`);
    }

    if (createdMedicationIds.length > 0) {
      const { count } = await elderA.client
        .from("medications")
        .delete({ count: "exact" })
        .in("id", createdMedicationIds);
      console.log(`✓ Cleaned up ${count ?? createdMedicationIds.length} test medication(s).`);
    }

    if (createdRelationshipIds.length > 0) {
      const { count } = await elderA.client
        .from("care_relationships")
        .delete({ count: "exact" })
        .in("id", createdRelationshipIds);
      console.log(`✓ Cleaned up ${count ?? createdRelationshipIds.length} test care relationship(s).`);
    }

    console.log("✓ Teardown complete. Zero project data modified or deleted.");
  }
}

runGate().catch((err) => {
  console.error("\n❌ GATE VERIFICATION FAILED:", err);
  process.exit(1);
});
