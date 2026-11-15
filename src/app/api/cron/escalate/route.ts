import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runEscalationCheck } from "@/services/escalation-runner";

function verifyBearerToken(authHeader: string | null, secret: string): boolean {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length !== secret.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !verifyBearerToken(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const summary = await runEscalationCheck(supabase);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
