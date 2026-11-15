"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/database";
import { claimElderInvite, createElderInvite, getInviteSummary } from "@/services/relationship-service";
import { emitAuditLog } from "@/services/audit-service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { evaluateSlidingRateLimit } from "@/lib/security";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
  };
}

export async function signUpUser(formData: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}): Promise<AuthResponse> {
  if (!formData.password || formData.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }
  if (formData.password.length > 128) {
    return { success: false, error: "Password cannot exceed 128 characters." };
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.fullName,
        role: formData.role,
        phone: formData.phone || null,
      },
    },
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || "Registration failed." };
  }

  // Insert profile row
  const { error: profileError } = await (supabase as any).from("profiles").upsert({
    id: data.user.id,
    full_name: formData.fullName,
    email: formData.email,
    role: formData.role,
    phone: formData.phone || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.warn("Profile creation warning:", profileError.message);
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email || formData.email,
      role: formData.role,
      fullName: formData.fullName,
    },
  };
}

export async function signInUser(formData: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || "Invalid credentials." };
  }

  // Fetch role and profile
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  const role: UserRole = profile?.role || (data.user.user_metadata?.role as UserRole) || "elder";
  const fullName = profile?.full_name || data.user.user_metadata?.full_name || "CareLedger User";

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email || formData.email,
      role,
      fullName,
    },
  };
}

export async function signOutUser(): Promise<{ success: boolean }> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getCurrentUserProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role || user.user_metadata?.role || "elder") as UserRole,
    fullName: profile?.full_name || user.user_metadata?.full_name || "CareLedger User",
    phone: profile?.phone || user.user_metadata?.phone || null,
  };
}

export async function getLinkedEldersAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Query relationships where user is caregiver
  const { data: relationships, error } = await (supabase as any)
    .from("care_relationships")
    .select("id, elder_id, relationship_type, status")
    .eq("caregiver_id", user.id)
    .eq("status", "active");

  if (error || !relationships || relationships.length === 0) {
    return [];
  }

  const elderIds = relationships.map((r: any) => r.elder_id);
  const { data: elders } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", elderIds);

  return (elders || []).map((elder: any) => ({
    id: elder.id,
    fullName: elder.full_name,
    email: elder.email,
    phone: elder.phone,
  }));
}

export async function claimElderInviteAction(inviteCode: string, relationshipType: string = "family") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required to claim relationship." };
  }

  try {
    const result = await claimElderInvite(supabase, user.id, inviteCode, relationshipType);
    revalidatePath("/caregiver");
    return { success: true, elderId: result.elderId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to claim invitation." };
  }
}

export async function createElderInviteAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  try {
    const invite = await createElderInvite(supabase, user.id);
    return { success: true, ...invite };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate invite." };
  }
}

/**
 * Requests a password reset email via Supabase Auth without disclosing account existence.
 */
export async function requestPasswordResetAction(
  email: string
): Promise<{ success: boolean; message: string }> {
  const trimmedEmail = (email || "").trim().toLowerCase();

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return {
      success: false,
      message: "Please provide a valid email address.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try {
    await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Suppress internal auth errors to avoid account enumeration
  }

  return {
    success: true,
    message:
      "If an account exists for this email address, password reset instructions have been dispatched.",
  };
}

/**
 * Updates an authenticated user's password following verification link callback.
 */
export async function updateUserPasswordAction(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }
  if (newPassword.length > 128) {
    return { success: false, error: "Password cannot exceed 128 characters." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Session expired or invalid. Please request a new password reset link.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const actorRole: "elder" | "caregiver" =
    user.user_metadata?.role === "caregiver" ? "caregiver" : "elder";

  await emitAuditLog(supabase, {
    elderId: user.id,
    actorId: user.id,
    actorRole,
    action: "password_reset",
    entityType: "care_relationship",
    entityId: user.id,
    newValues: { password_updated: true },
  });

  return { success: true };
}

/**
 * Non-sensitive invitation inspection for caregiver acceptance review.
 * Enforces edge and server-side abuse prevention:
 * - Uses trusted platform IP (x-vercel-ip or x-real-ip) and hashes it with server salt
 * - Applies per-invitation code abuse controls (hashed key) to stop code enumeration
 * - Protects against global DoS while preserving anonymous preview capabilities
 */
export async function getInviteSummaryAction(rawCode: string) {
  if (!rawCode || rawCode.trim().length === 0) {
    return { valid: false, status: "not_found" as const };
  }

  try {
    // 1. Edge/Platform Client Identity Rate Limit (IP-based)
    const headerList = await headers();
    const clientIp = headerList.get("x-vercel-ip") || headerList.get("x-real-ip");
    if (clientIp) {
      const ipHash = createHash("sha256")
        .update(clientIp + (process.env.CRON_SECRET || "careledger-salt"))
        .digest("hex")
        .slice(0, 16);
      const ipLimit = evaluateSlidingRateLimit(`summary:ip:${ipHash}`, 15, 60_000);
      if (!ipLimit.allowed) {
        return { valid: false, status: "not_found" as const };
      }
    }

    // 2. Per-Invitation Abuse Control (hash code to avoid storing/logging plaintext in keys)
    const normalizedCode = rawCode.trim().toUpperCase();
    const codeHash = createHash("sha256").update(normalizedCode).digest("hex").slice(0, 16);
    const codeLimit = evaluateSlidingRateLimit(`summary:code:${codeHash}`, 10, 60_000);
    if (!codeLimit.allowed) {
      return { valid: false, status: "not_found" as const };
    }
  } catch {
    // Request context fallback if invoked outside HTTP cycle
  }

  const supabase = await createServerSupabaseClient();
  return getInviteSummary(supabase, rawCode);
}

/**
 * Completes Care Circle onboarding, setting emergency contacts and recording explicit privacy consent.
 */
export async function completeCareCircleOnboardingAction(formData: {
  emergencyContactPhone?: string;
  emergencyNotes?: string;
  consentedSharing: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required to complete onboarding." };
  }

  if (!formData.consentedSharing) {
    return {
      success: false,
      error: "Care circle coordination requires affirmative privacy and data-sharing consent.",
    };
  }

  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      emergency_contact_phone: formData.emergencyContactPhone || null,
      emergency_notes: formData.emergencyNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  const actorRole: "elder" | "caregiver" =
    user.user_metadata?.role === "caregiver" ? "caregiver" : "elder";

  await emitAuditLog(supabase, {
    elderId: user.id,
    actorId: user.id,
    actorRole,
    action: "complete_onboarding",
    entityType: "care_relationship",
    entityId: user.id,
    newValues: {
      emergency_phone_configured: Boolean(formData.emergencyContactPhone),
      data_sharing_consented: true,
    },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
