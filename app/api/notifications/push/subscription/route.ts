import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

async function authenticatedClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export async function POST(request: Request) {
  const authenticated = await authenticatedClient(request);
  if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as SubscriptionBody;
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
  const body = await request.json() as SubscriptionBody;
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
