import { describe, it, expect } from "vitest";
import {
  generateSecureInviteCode,
  generateManualVerificationCode,
  calculateManualInviteExpiration,
  generateActionToken,
  hashPin,
  verifyPin,
} from "@/lib/security";

describe("Security & Cryptographic Invariants", () => {
  it("generates formatted, high-entropy 128-bit invite codes", () => {
    const code1 = generateSecureInviteCode();
    const code2 = generateSecureInviteCode();

    // 128 bits = 32 hex chars formatted in 4 blocks of 8
    expect(code1).toMatch(/^CARE-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(code2).toMatch(/^CARE-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    expect(code1).not.toBe(code2);
  });

  it("generates bounded manual verification codes with 15m expiration", () => {
    const manualCode = generateManualVerificationCode();
    expect(manualCode).toMatch(/^[1-9][0-9]{5}$/);

    const now = new Date();
    const expiry = calculateManualInviteExpiration(now);
    expect(expiry.getTime() - now.getTime()).toBe(15 * 60 * 1000);
  });

  it("generates opaque 256-bit action tokens (64 hex characters)", () => {
    const token = generateActionToken();
    expect(token).toHaveLength(64);
  });

  it("never stores plaintext PINs — hashes and verifies deterministically", () => {
    const rawPin = "4829";
    const hashed = hashPin(rawPin);

    // Ensure raw PIN is never stored or matched directly
    expect(hashed).not.toBe(rawPin);
    expect(hashed).toMatch(/^pbkdf2:600000:[a-f0-9]{32}:[a-f0-9]{64}$/);

    // Correct PIN verifies
    expect(verifyPin(rawPin, hashed)).toBe(true);

    // Incorrect PIN rejected
    expect(verifyPin("0000", hashed)).toBe(false);
    expect(verifyPin("4828", hashed)).toBe(false);
  });
});
