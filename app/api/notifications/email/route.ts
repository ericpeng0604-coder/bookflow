import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverNotificationEmails } from "@/lib/server/notification-email";
import { enforceRateLimit } from "@/lib/server/api-security";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !anonKey || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Email service is not configured" }, { status: 503 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const rateLimited = await enforceRateLimit(admin, request, {
      scope: "notification-email-dispatch",
      identity: authData.user.id,
      limit: 8,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "Email dispatch is temporarily unavailable" }, { status: 503 });
  }
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  try {
    return NextResponse.json(await deliverNotificationEmails(admin, {
      actorId: authData.user.id,
      since,
      limit: 20,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email delivery failed" },
      { status: 503 },
    );
  }
}
