import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverBrowserPush } from "@/lib/server/notification-push";

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
