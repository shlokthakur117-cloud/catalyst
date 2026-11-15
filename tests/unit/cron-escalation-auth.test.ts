import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/escalate/route";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/escalation-runner", () => ({
  runEscalationCheck: vi.fn().mockResolvedValue({
    evaluatedDoses: 5,
    escalatedCount: 1,
    notificationsDispatched: 1,
    errors: [],
  }),
}));

describe("Cron Escalation Route Authentication Gate (/api/cron/escalate)", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("1. Missing CRON_SECRET environment variable — fails closed with 503 Service Unavailable", async () => {
    delete process.env.CRON_SECRET;

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
      headers: {
        authorization: "Bearer some-token",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("CRON_SECRET is not configured");
  });

  it("2. Missing Authorization header — rejected with 401 Unauthorized", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("3. Malformed Authorization header (non-Bearer) — rejected with 401 Unauthorized", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
      headers: {
        authorization: "Basic dXNlcjpwYXNz",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("4. Malformed Authorization header (Bearer prefix only, empty token) — rejected with 401 Unauthorized", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
      headers: {
        authorization: "Bearer ",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("5. Incorrect CRON_SECRET token — rejected with 401 Unauthorized", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
      headers: {
        authorization: "Bearer invalid_wrong_cron_token_99999",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    // Ensure the secret is never exposed in response body
    expect(JSON.stringify(body)).not.toContain("production_super_secret_cron_key_12345");
  });

  it("6. Correct CRON_SECRET token via GET — executes escalation check with 200 OK", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "GET",
      headers: {
        authorization: "Bearer production_super_secret_cron_key_12345",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.summary.escalatedCount).toBe(1);
    expect(JSON.stringify(body)).not.toContain("production_super_secret_cron_key_12345");
  });

  it("7. Correct CRON_SECRET token via POST — executes escalation check with 200 OK", async () => {
    process.env.CRON_SECRET = "production_super_secret_cron_key_12345";

    const request = new NextRequest("http://localhost:3000/api/cron/escalate", {
      method: "POST",
      headers: {
        authorization: "Bearer production_super_secret_cron_key_12345",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.summary.escalatedCount).toBe(1);
  });
});
