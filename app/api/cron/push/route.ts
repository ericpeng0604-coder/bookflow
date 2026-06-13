import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverBrowserPush } from "@/lib/server/notification-push";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.PUSH_DISPATCH_SECRET || token !== process.env.PUSH_DISPATCH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service is not configured" }, { status: 503 });
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    return NextResponse.json(await deliverBrowserPush(admin, { limit: 100 }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Push delivery failed" },
      { status: 503 },
    );
  }
}
