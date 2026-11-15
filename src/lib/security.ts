import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * OWASP Password Storage Guidelines (Current Recommendation):
 * PBKDF2-HMAC-SHA256: 600,000 iterations.
 * Execution benchmark: ~95-100ms on modern CPU, ensuring responsive user verification
 * while offering strong resistance against GPU/ASIC offline dictionary attacks.
 */
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_KEYLEN = 32;
export const PBKDF2_DIGEST = "sha256";

/**
 * Hashes a numeric PIN using PBKDF2 with 600,000 iterations and a cryptographically secure random salt.
 * Output format: `pbkdf2:600000:<saltHex>:<hashHex>`
 */
export function hashPin(pin: string, customSaltHex?: string): string {
  const salt = customSaltHex || randomBytes(16).toString("hex");
  const derivedKey = pbkdf2Sync(
    pin,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a candidate PIN against a stored PBKDF2 hash using timing-safe comparison.
 */
export function verifyPin(candidatePin: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalHash = Buffer.from(parts[3], "hex");

    const candidateHash = pbkdf2Sync(
      candidatePin,
      salt,
      iterations,
      originalHash.length,
      PBKDF2_DIGEST
    );

    return timingSafeEqual(candidateHash, originalHash);
  } catch {
    return false;
  }
}

/**
 * Builds a composite rate-limit key combining server-verified client IP and user context.
 * Never trust a client-supplied identifier as the sole rate-limit key.
 */
export function buildRateLimitKey(
  clientIp: string,
  action: string,
  identifier?: string
): string {
  const safeIp = (clientIp || "unknown_ip").trim();
  const safeAction = action.trim();
  const safeId = identifier ? `:${identifier.trim().toLowerCase()}` : "";
  return `rl:${safeIp}:${safeAction}${safeId}`;
}

/**
 * In-Memory Fallback Rate Limiter (for offline unit tests)
 */
interface RateLimitRecord {
  failedAttempts: number;
  lockedUntil: number | null;
  firstAttemptAt: number;
}

const localRateLimitStore = new Map<string, RateLimitRecord>();

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(key: string, nowMs: number = Date.now()): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const record = localRateLimitStore.get(key);

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (record.lockedUntil && nowMs < record.lockedUntil) {
    const retryAfter = Math.ceil((record.lockedUntil - nowMs) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
    };
  }

  if (record.lockedUntil && nowMs >= record.lockedUntil) {
    localRateLimitStore.delete(key);
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - record.failedAttempts);
  return {
    allowed: remaining > 0,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
  };
}

export function recordFailedAttempt(key: string, nowMs: number = Date.now()): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  let record = localRateLimitStore.get(key);

  if (!record || (record.lockedUntil && nowMs >= record.lockedUntil)) {
    record = {
      failedAttempts: 1,
      lockedUntil: null,
      firstAttemptAt: nowMs,
    };
  } else {
    record.failedAttempts += 1;
  }

  if (record.failedAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    record.lockedUntil = nowMs + RATE_LIMIT_LOCKOUT_MS;
    localRateLimitStore.set(key, record);
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_LOCKOUT_MS / 1000),
    };
  }

  localRateLimitStore.set(key, record);
  return {
    locked: false,
    remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - record.failedAttempts,
    retryAfterSeconds: 0,
  };
}

export function recordSuccessfulAttempt(key: string): void {
  localRateLimitStore.delete(key);
}

/**
 * Sliding-window rate limit evaluator for edge/server routes.
 * Tracks attempts within a rolling window without unbounded row growth.
 */
export function evaluateSlidingRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const existing = localRateLimitStore.get(key);
  if (!existing || (existing.firstAttemptAt && nowMs - existing.firstAttemptAt > windowMs)) {
    localRateLimitStore.set(key, {
      failedAttempts: 1,
      firstAttemptAt: nowMs,
      lockedUntil: null,
    });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (existing.failedAttempts >= maxRequests) {
    const retryAfter = Math.ceil((existing.firstAttemptAt + windowMs - nowMs) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  existing.failedAttempts += 1;
  localRateLimitStore.set(key, existing);
  return {
    allowed: true,
    remaining: maxRequests - existing.failedAttempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Distributed Server-Side Rate Limiter using Supabase PostgreSQL atomic function.
 * Survives serverless cold starts and coordinates across multi-instance deployments.
 */
export async function checkRateLimitDistributed(
  supabase: SupabaseClient<Database> | null,
  key: string,
  maxAttempts: number = RATE_LIMIT_MAX_ATTEMPTS,
  lockoutSeconds: number = 900
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds: number }> {
  if (!supabase) {
    return checkRateLimit(key);
  }

  try {
    const { data, error } = await (supabase as any).rpc("check_and_record_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_lockout_seconds: lockoutSeconds,
    });

    if (error || !data) {
      // Graceful fallback to in-memory if DB call fails
      return checkRateLimit(key);
    }

    return {
      allowed: data.allowed ?? true,
      remainingAttempts: data.remaining_attempts ?? maxAttempts,
      retryAfterSeconds: data.retry_after_seconds ?? 0,
    };
  } catch {
    return checkRateLimit(key);
  }
}

/**
 * Resets a distributed rate-limit entry after successful authentication.
 */
export async function resetRateLimitDistributed(
  supabase: SupabaseClient<Database> | null,
  key: string
): Promise<void> {
  recordSuccessfulAttempt(key);
  if (!supabase) return;

  try {
    await (supabase as any).rpc("reset_rate_limit", { p_key: key });
  } catch {
    // Ignore non-fatal reset errors
  }
}

/**
 * Generates a cryptographically secure random invitation credential for caregiver-elder linking.
 * Uses at least 128 bits of cryptographic randomness (16 bytes = 32 hex characters).
 * Formatted as: CARE-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
 */
export function generateSecureInviteCode(): string {
  const bytes = randomBytes(16); // 128 bits of cryptographic entropy
  const p1 = bytes.subarray(0, 4).toString("hex").toUpperCase();
  const p2 = bytes.subarray(4, 8).toString("hex").toUpperCase();
  const p3 = bytes.subarray(8, 12).toString("hex").toUpperCase();
  const p4 = bytes.subarray(12, 16).toString("hex").toUpperCase();
  return `CARE-${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Dedicated short manual verification code for voice or elder phone-call handoff.
 * Constrained by strict security boundaries:
 * - 15-minute maximum lifetime.
 * - Maximum 3 failed validation attempts before lockout.
 * - SHA-256 hashed at rest.
 * - Raw token is NEVER logged.
 */
export const MANUAL_INVITE_EXPIRATION_MINUTES = 15;
export const MANUAL_INVITE_MAX_ATTEMPTS = 3;

export function generateManualVerificationCode(): string {
  // 6-digit numeric verification code for telephone handoff
  const bytes = randomBytes(4);
  const code = (bytes.readUInt32BE(0) % 900000 + 100000).toString();
  return code;
}

export function calculateManualInviteExpiration(now: Date = new Date()): Date {
  return new Date(now.getTime() + MANUAL_INVITE_EXPIRATION_MINUTES * 60 * 1000);
}

export const INVITE_EXPIRATION_HOURS = 48;

export function calculateInviteExpiration(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);
}

export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiry = new Date(expiresAt).getTime();
  return now.getTime() > expiry;
}

/**
 * Deterministically hashes an invitation token with SHA-256 for at-rest storage.
 * Normalized to uppercase and trimmed. Raw tokens are never logged.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim().toUpperCase()).digest("hex");
}

/**
 * 256-bit cryptographically secure opaque token for URL invitation links (32 bytes = 64 hex characters).
 */
export function generateActionToken(): string {
  return randomBytes(32).toString("hex");
}

export { sanitizeRedirectUrl } from "./url-security";
