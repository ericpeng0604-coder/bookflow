import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  exceedsContentLength,
  isJsonRequest,
} from "@/lib/server/api-security";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

async function authenticatedClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, admin, userId: data.user.id };
}

export async function POST(request: Request) {
  const authenticated = await authenticatedClient(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  if (exceedsContentLength(request, 8192)) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  try {
    const rateLimited = await enforceRateLimit(authenticated.admin, request, {
      scope: "push-subscription-write",
      identity: authenticated.userId,
      limit: 20,
      windowSeconds: 3600,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "Push security check failed" }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as SubscriptionBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }
  const { error } = await authenticated.client.from("push_subscriptions").upsert({
    user_id: authenticated.userId,
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || "",
    enabled: true,
    failure_count: 0,
    last_error: "",
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authenticated = await authenticatedClient(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  if (exceedsContentLength(request, 8192)) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  try {
    const rateLimited = await enforceRateLimit(authenticated.admin, request, {
      scope: "push-subscription-delete",
      identity: authenticated.userId,
      limit: 20,
      windowSeconds: 3600,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "Push security check failed" }, { status: 503 });
  }
  const body = await request.json().catch(() => null) as SubscriptionBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const endpoint = body.endpoint?.trim();
  if (!endpoint) return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  const { error } = await authenticated.client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", authenticated.userId)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
