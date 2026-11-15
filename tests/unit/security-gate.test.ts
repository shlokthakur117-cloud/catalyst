import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPin,
  verifyPin,
  generateSecureInviteCode,
  calculateInviteExpiration,
  isInviteExpired,
  hashToken,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  RATE_LIMIT_MAX_ATTEMPTS,
} from "@/lib/security";
import { validateDoseTransition } from "@/services/dose-engine";

describe("Security Gate — Cryptography & Access Control Verification", () => {
  describe("1. PBKDF2 PIN Hashing & Resistance", () => {
    it("generates salted PBKDF2 hash with 600,000 iterations according to current OWASP guidance", () => {
      const pin = "1234";
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);

      // Verify format
      expect(hash1).toMatch(/^pbkdf2:600000:[a-f0-9]{32}:[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^pbkdf2:600000:[a-f0-9]{32}:[a-f0-9]{64}$/);

      // Uniqueness due to unique random per-call salts
      expect(hash1).not.toBe(hash2);

      // Verifies correctly
      expect(verifyPin(pin, hash1)).toBe(true);
      expect(verifyPin(pin, hash2)).toBe(true);
      expect(verifyPin("9999", hash1)).toBe(false);
    });

    it("timingSafeEqual safely rejects malformed or truncated hashes", () => {
      expect(verifyPin("1234", "invalid_hash_string")).toBe(false);
      expect(verifyPin("1234", "pbkdf2:600000:abc")).toBe(false);
    });
  });

  describe("2. Rate Limiting Protection Against Brute Force", () => {
    const testKey = "user-attempt-test";

    beforeEach(() => {
      recordSuccessfulAttempt(testKey);
    });

    it("allows up to 5 attempts before enforcing a 15-minute lockout", () => {
      for (let i = 1; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
        const attempt = recordFailedAttempt(testKey);
        expect(attempt.locked).toBe(false);
        expect(attempt.remainingAttempts).toBe(RATE_LIMIT_MAX_ATTEMPTS - i);
      }

      // 5th attempt must trigger lockout
      const finalAttempt = recordFailedAttempt(testKey);
      expect(finalAttempt.locked).toBe(true);
      expect(finalAttempt.remainingAttempts).toBe(0);
      expect(finalAttempt.retryAfterSeconds).toBeGreaterThan(800);

      // Subsequent check must be blocked
      const status = checkRateLimit(testKey);
      expect(status.allowed).toBe(false);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("resets attempt counter upon successful authentication", () => {
      recordFailedAttempt(testKey);
      recordFailedAttempt(testKey);
      expect(checkRateLimit(testKey).remainingAttempts).toBe(3);

      recordSuccessfulAttempt(testKey);
      expect(checkRateLimit(testKey).remainingAttempts).toBe(5);
      expect(checkRateLimit(testKey).allowed).toBe(true);
    });
  });

  describe("3. Secure Expiring Invitation Tokens", () => {
    it("generates high-entropy formatted invite codes (128-bit)", () => {
      const code = generateSecureInviteCode();
      expect(code).toMatch(/^CARE-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/);
    });

    it("hashes invite tokens at rest deterministically", () => {
      const code = "CARE-12AB-CD34";
      const hash1 = hashToken(code);
      const hash2 = hashToken("care-12ab-cd34 "); // Case and whitespace insensitive

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it("accurately detects expired vs valid invitation timestamps", () => {
      const now = new Date();
      const futureExpiry = calculateInviteExpiration(now); // +48 hours
      const pastExpiry = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

      expect(isInviteExpired(futureExpiry.toISOString(), now)).toBe(false);
      expect(isInviteExpired(pastExpiry.toISOString(), now)).toBe(true);
    });
  });

  describe("4. RLS & Server-Side Authorization Invariants", () => {
    it("prohibits system role from confirming patient ingestion", () => {
      expect(() =>
        validateDoseTransition({
          doseId: "dose-1",
          fromStatus: "scheduled",
          toStatus: "taken",
          actorId: "system",
          actorRole: "system",
        })
      ).toThrow();
    });

    it("requires caregiver alert flag when elder reports unsure", () => {
      const result = validateDoseTransition({
        doseId: "dose-1",
        fromStatus: "reminded",
        toStatus: "unsure",
        actorId: "elder-1",
        actorRole: "elder",
      });
      expect(result.valid).toBe(true);
      expect(result.requiresCaregiverAlert).toBe(true);
    });

    it("requires caregiver alert flag when dose transitions to unconfirmed", () => {
      const result = validateDoseTransition({
        doseId: "dose-1",
        fromStatus: "reminded",
        toStatus: "unconfirmed",
        actorId: "system",
        actorRole: "system",
      });
      expect(result.valid).toBe(true);
      expect(result.requiresCaregiverAlert).toBe(true);
    });
  });
});
