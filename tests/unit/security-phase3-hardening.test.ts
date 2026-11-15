import { describe, it, expect, vi } from "vitest";
import { sanitizeRedirectUrl } from "@/lib/security";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import { requestPasswordResetAction, signUpUser, updateUserPasswordAction } from "@/app/actions/auth";

describe("Phase 3 Security Hardening & Open Redirect Protection", () => {
  describe("Open Redirect Sanitization (CWE-601)", () => {
    it("permits safe internal relative paths", () => {
      expect(sanitizeRedirectUrl("/elder")).toBe("/elder");
      expect(sanitizeRedirectUrl("/caregiver")).toBe("/caregiver");
      expect(sanitizeRedirectUrl("/onboarding")).toBe("/onboarding");
      expect(sanitizeRedirectUrl("/invite/CARE-1234-5678-90AB-CDEF")).toBe(
        "/invite/CARE-1234-5678-90AB-CDEF"
      );
      expect(sanitizeRedirectUrl("/elder?view=calendar#today")).toBe(
        "/elder?view=calendar#today"
      );
    });

    it("rejects external absolute URLs", () => {
      expect(sanitizeRedirectUrl("https://evil.com")).toBeNull();
      expect(sanitizeRedirectUrl("http://attacker.org/phish")).toBeNull();
      expect(sanitizeRedirectUrl("//evil.com")).toBeNull();
      expect(sanitizeRedirectUrl("//evil.com/login")).toBeNull();
      expect(sanitizeRedirectUrl("/\\evil.com")).toBeNull();
    });

    it("rejects javascript:, data:, and malicious protocol schemes", () => {
      expect(sanitizeRedirectUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeRedirectUrl("vbscript:msgbox(1)")).toBeNull();
    });

    it("rejects URLs containing control characters or whitespace attacks", () => {
      expect(sanitizeRedirectUrl("/elder\n/evil")).toBeNull();
      expect(sanitizeRedirectUrl("/elder\r\nevil")).toBeNull();
      expect(sanitizeRedirectUrl("/elder\0evil")).toBeNull();
      expect(sanitizeRedirectUrl("")).toBeNull();
      expect(sanitizeRedirectUrl(null)).toBeNull();
      expect(sanitizeRedirectUrl(undefined)).toBeNull();
    });
  });

  describe("Password Policy & DoS Protection (NIST SP 800-63B)", () => {
    it("rejects passwords shorter than 8 characters during signup", async () => {
      const res = await signUpUser({
        email: "test@example.com",
        password: "short",
        fullName: "Test User",
        role: "elder",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 8 characters/i);
    });

    it("rejects oversized passwords exceeding 128 characters to prevent hash exhaustion DoS", async () => {
      const longPassword = "A".repeat(129) + "1!";
      const res = await signUpUser({
        email: "test@example.com",
        password: longPassword,
        fullName: "Test User",
        role: "elder",
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cannot exceed 128 characters/i);
    });

    it("rejects password update exceeding 128 characters", async () => {
      const longPassword = "B".repeat(130);
      const res = await updateUserPasswordAction(longPassword);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/(at least 8 characters|cannot exceed 128 characters|Session expired)/i);
    });
  });

  describe("Non-Enumerating Password Recovery", () => {
    it("returns a generic non-disclosing message for invalid and valid email requests", async () => {
      const invalidEmailRes = await requestPasswordResetAction("invalid-format");
      expect(invalidEmailRes.success).toBe(false);

      const unregisteredRes = await requestPasswordResetAction("nobody.exists.999@careledger.org");
      expect(unregisteredRes.success).toBe(true);
      expect(unregisteredRes.message).toBe(
        "If an account exists for this email address, password reset instructions have been dispatched."
      );
    });
  });
});
