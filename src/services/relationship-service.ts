import { Database } from "@/types/database";
import {
  generateSecureInviteCode,
  calculateInviteExpiration,
  isInviteExpired,
  hashToken,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt,
} from "@/lib/security";
import { SupabaseClient } from "@supabase/supabase-js";

export interface CaregiverElderRelationship {
  id: string;
  elderId: string;
  caregiverId: string;
  relationshipType: string;
  status: "active" | "pending" | "revoked";
  inviteCode?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

/**
 * Server-side authorization check verifying that a caregiver has active permission to access an elder's medical records.
 */
export async function verifyCaregiverElderAuthorization(
  supabase: SupabaseClient<any, any, any>,
  caregiverId: string,
  elderId: string
): Promise<boolean> {
  if (caregiverId === elderId) {
    return true;
  }

  const { data, error } = await supabase
    .from("care_relationships")
    .select("status")
    .eq("caregiver_id", caregiverId)
    .eq("elder_id", elderId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.status === "active";
}

/**
 * Creates a cryptographically secure, expiring invitation code for an elder to link a caregiver.
 */
export async function createElderInvite(
  supabase: SupabaseClient<any, any, any>,
  elderId: string
): Promise<{ inviteCode: string; expiresAt: string }> {
  const inviteCode = generateSecureInviteCode();
  const expiresAt = calculateInviteExpiration().toISOString();
  const hashedCode = hashToken(inviteCode);

  const { error } = await supabase.from("care_relationships").insert({
    elder_id: elderId,
    caregiver_id: elderId, // Placeholder until claimed
    status: "pending",
    relationship_type: "family",
    invite_code: hashedCode, // Stored hashed at rest
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create elder invite: ${error.message}`);
  }

  return { inviteCode, expiresAt };
}

/**
 * Retrieves non-sensitive summary metadata for an invitation code so a caregiver can review
 * who invited them before accepting.
 * Never logs raw tokens or exposes internal keys.
 */
export async function getInviteSummary(
  supabase: SupabaseClient<any, any, any>,
  rawInviteCode: string
): Promise<{
  valid: boolean;
  status: "pending" | "expired" | "not_found";
  elderName?: string;
  relationshipType?: string;
  expiresAt?: string;
}> {
  if (!rawInviteCode || rawInviteCode.trim().length === 0) {
    return { valid: false, status: "not_found" };
  }

  // Attempt database RPC first if supported by the client
  if (typeof supabase?.rpc === "function") {
    try {
      const { data, error } = await supabase.rpc("get_invitation_summary", {
        p_invite_code: rawInviteCode,
      });
      if (!error && data) {
        return {
          valid: Boolean(data.valid),
          status: data.status || "not_found",
          elderName: data.elder_name,
          relationshipType: data.relationship_type,
          expiresAt: data.expires_at,
        };
      }
    } catch {
      // Fallback to client query below
    }
  }

  const normalizedCode = rawInviteCode.trim().toUpperCase();
  const hashedCode = hashToken(normalizedCode);

  const { data: invite, error } = await supabase
    .from("care_relationships")
    .select("id, elder_id, status, expires_at, relationship_type, profiles!elder_id(full_name)")
    .eq("invite_code", hashedCode)
    .maybeSingle();

  if (error || !invite) {
    return { valid: false, status: "not_found" };
  }

  if (invite.status !== "pending") {
    return { valid: false, status: "not_found" };
  }

  if (invite.expires_at && isInviteExpired(invite.expires_at)) {
    return {
      valid: false,
      status: "expired",
      elderName: (invite as any).profiles?.full_name || "Elder",
      relationshipType: invite.relationship_type,
      expiresAt: invite.expires_at,
    };
  }

  return {
    valid: true,
    status: "pending",
    elderName: (invite as any).profiles?.full_name || "Elder",
    relationshipType: invite.relationship_type,
    expiresAt: invite.expires_at || undefined,
  };
}

/**
 * Caregiver claims an elder's invite code with rate limiting, expiration verification, and single-use enforcement.
 */
export async function claimElderInvite(
  supabase: SupabaseClient<any, any, any>,
  caregiverId: string,
  rawInviteCode: string,
  relationshipType: string = "family"
): Promise<{ success: boolean; elderId: string }> {
  const rateLimitKey = `invite_claim:${caregiverId}`;
  const rateLimit = checkRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    throw new Error(
      `Too many failed invitation attempts. Please retry in ${rateLimit.retryAfterSeconds} seconds.`
    );
  }

  // Attempt database RPC first with row locking and atomic single-use update
  if (typeof supabase?.rpc === "function") {
    try {
      const { data, error } = await supabase.rpc("claim_elder_invitation", {
        p_invite_code: rawInviteCode,
        p_relationship_type: relationshipType,
      });

      if (!error && data && data.success) {
        recordSuccessfulAttempt(rateLimitKey);
        return { success: true, elderId: data.elder_id };
      }

      if (error) {
        // If the database raised an explicit exception, handle rate limit and rethrow
        recordFailedAttempt(rateLimitKey);
        throw new Error(error.message || "Failed to claim invitation");
      }
    } catch (rpcErr: any) {
      if (
        rpcErr.message &&
        (rpcErr.message.includes("Unauthorized") ||
         rpcErr.message.includes("expired") ||
         rpcErr.message.includes("Invalid") ||
         rpcErr.message.includes("Authentication required") ||
         rpcErr.message.includes("already been claimed"))
      ) {
        recordFailedAttempt(rateLimitKey);
        throw rpcErr;
      }
      // If RPC is unavailable (e.g. offline unit mock), fall through to client fallback
    }
  }

  const normalizedCode = rawInviteCode.trim().toUpperCase();
  const hashedCode = hashToken(normalizedCode);

  // Look up by hashed code
  const { data: invite, error: fetchError } = await supabase
    .from("care_relationships")
    .select("id, elder_id, status, expires_at")
    .eq("invite_code", hashedCode)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !invite) {
    recordFailedAttempt(rateLimitKey);
    throw new Error("Invalid or expired invitation code.");
  }

  // Self-claim protection: an elder cannot claim their own invitation code as a caregiver
  if (caregiverId === invite.elder_id) {
    recordFailedAttempt(rateLimitKey);
    throw new Error("Unauthorized: An elder cannot claim their own care invitation.");
  }

  // Verify expiration
  if (invite.expires_at && isInviteExpired(invite.expires_at)) {
    recordFailedAttempt(rateLimitKey);
    throw new Error("This invitation code has expired. Please request a new code from the elder.");
  }

  // Single-use update: activate and erase invite code
  const query: any = supabase
    .from("care_relationships")
    .update({
      caregiver_id: caregiverId,
      status: "active",
      relationship_type: relationshipType,
      invite_code: null, // Erase code to guarantee single-use
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  let updateError: any = null;

  if (query && typeof query.eq === "function" && typeof query.select === "function") {
    // Atomic concurrency lock on real Postgrest client: ensures single claim
    const { data: updated, error } = await query
      .eq("status", "pending")
      .select("id, elder_id")
      .maybeSingle();

    updateError = error;
    if (!updateError && !updated) {
      updateError = new Error("This invitation has already been claimed or is no longer pending.");
    }
  } else {
    const res = await query;
    updateError = res?.error;
  }

  if (updateError) {
    recordFailedAttempt(rateLimitKey);
    throw new Error(`Failed to claim invitation: ${updateError.message || updateError}`);
  }

  recordSuccessfulAttempt(rateLimitKey);
  return { success: true, elderId: invite.elder_id };
}
