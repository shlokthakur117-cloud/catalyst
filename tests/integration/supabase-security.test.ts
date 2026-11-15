import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } from "@/lib/security";

if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile(".env.local");
  } catch {}
}

describe("Live Supabase Integration & RLS Security Gate", () => {
  let supabase: SupabaseClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shsvqcipprcoqzgyibig.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // FAIL-FAST PROJECT-REF GUARD
  if (!supabaseUrl.includes("shsvqcipprcoqzgyibig") || supabaseUrl.includes("hqowqhajrsgahfwjcojo")) {
    throw new Error(
      `CRITICAL ISOLATION BREACH: Test suite attempted to run against prohibited project: ${supabaseUrl}. Expected dedicated project: shsvqcipprcoqzgyibig`
    );
  }

  beforeAll(() => {
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live integration tests.");
    }
    expect(supabaseUrl).toContain("shsvqcipprcoqzgyibig");
    expect(supabaseUrl).not.toContain("hqowqhajrsgahfwjcojo");
    supabase = createClient(supabaseUrl, anonKey);
  });

  describe("1. Real Supabase Gateway & Auth Service Connectivity", () => {
    it("connects to live Supabase Auth service and receives GoTrue health confirmation", async () => {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: anonKey! },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("GoTrue");
    });
  });

  describe("2. Database RLS Read Protection (Negative Read Authorization)", () => {
    it("denies unauthenticated anonymous reads from public.profiles", async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      expect(error).toBeNull();
      // RLS policy permits SELECT only for auth.uid() = id or active care_relationships
      expect(data).toEqual([]);
    });

    it("denies unauthenticated anonymous reads from public.medications", async () => {
      const { data, error } = await supabase.from("medications").select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("denies unauthenticated anonymous reads from public.dose_logs", async () => {
      const { data, error } = await supabase.from("dose_logs").select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("denies unauthenticated anonymous reads from public.care_relationships", async () => {
      const { data, error } = await supabase.from("care_relationships").select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("3. Database RLS Write Protection (Negative Mutation Authorization)", () => {
    it("rejects direct unauthorized INSERT into public.profiles with RLS violation error", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000099";
      const { data, error } = await supabase.from("profiles").insert({
        id: fakeId,
        role: "caregiver",
        full_name: "Attacker User",
        email: "attacker@malicious.org",
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/violates row-level security policy/i);
    });

    it("rejects direct unauthorized INSERT into public.medications with RLS violation error", async () => {
      const { data, error } = await supabase.from("medications").insert({
        elder_id: "00000000-0000-0000-0000-000000000001",
        name: "Unauthorized Drug Injection",
        strength: "500mg",
        instructions: "Take immediately",
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/violates row-level security policy/i);
    });

    it("rejects direct unauthorized INSERT into public.care_relationships with RLS violation error", async () => {
      const { data, error } = await supabase.from("care_relationships").insert({
        elder_id: "00000000-0000-0000-0000-000000000001",
        caregiver_id: "00000000-0000-0000-0000-000000000002",
        status: "active",
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/violates row-level security policy/i);
    });

    it("rejects direct unauthorized UPDATE into public.dose_logs to prevent spoofing Taken status", async () => {
      const { data, error } = await supabase
        .from("dose_logs")
        .update({ status: "taken" })
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .select();

      // Zero rows updated because RLS filters out rows where user is not authorized
      expect(data).toEqual([]);
    });
  });

  describe("4. Non-Enumerating Password Reset over Live GoTrue Gateway", () => {
    it("dispatches password reset request without exposing whether account exists", async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(
        "nonexistent.user.test@careledger.org"
      );
      // Supabase GoTrue returns success (error is null) without confirming account presence
      expect(error).toBeNull();
    });
  });

  describe("5. Rate Limiter Gate Protection Against Brute Force", () => {
    it("enforces attempt lockout after 5 consecutive failed invitation claims", () => {
      const testKey = `rl:test_ip_${Date.now()}:invite_claim`;
      recordSuccessfulAttempt(testKey);

      // 4 attempts allowed
      for (let i = 1; i <= 4; i++) {
        recordFailedAttempt(testKey);
        const check = checkRateLimit(testKey);
        expect(check.allowed).toBe(true);
      }

      // 5th failed attempt triggers lockout
      recordFailedAttempt(testKey);
      const lockedCheck = checkRateLimit(testKey);
      expect(lockedCheck.allowed).toBe(false);
      expect(lockedCheck.remainingAttempts).toBe(0);
      expect(lockedCheck.retryAfterSeconds).toBeGreaterThan(0);

      // Clean up test key
      recordSuccessfulAttempt(testKey);
    });
  });
});
