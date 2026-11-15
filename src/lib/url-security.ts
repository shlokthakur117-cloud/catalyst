/**
 * URL and Navigation Security Utilities (Edge-Compatible).
 * Free of Node.js-only builtins so it can be safely used in Next.js Middleware and Edge routes.
 */

/**
 * Validates and sanitizes a candidate redirect URL to prevent Open Redirect (CWE-601).
 * Strictly requires an absolute path on the same origin (starts with single '/' and not '//' or '/\').
 * Rejects external origins, protocol-relative URLs, javascript: URIs, and control characters.
 */
export function sanitizeRedirectUrl(candidateUrl: string | null | undefined): string | null {
  if (!candidateUrl) return null;
  const trimmed = candidateUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return null;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}
