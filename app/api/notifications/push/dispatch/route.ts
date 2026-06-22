import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverBrowserPush } from "@/lib/server/notification-push";
import { enforceRateLimit } from "@/lib/server/api-security";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const rateLimited = await enforceRateLimit(admin, request, {
      scope: "notification-push-dispatch",
      identity: data.user.id,
      limit: 8,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "Push dispatch is temporarily unavailable" }, { status: 503 });
  }
  try {
    return NextResponse.json(await deliverBrowserPush(admin, {
      actorId: data.user.id,
      since: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      limit: 30,
    }));
  } catch (pushError) {
    return NextResponse.json(
      { error: pushError instanceof Error ? pushError.message : "Push delivery failed" },
      { status: 503 },
    );
  }
}
