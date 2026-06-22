import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  exceedsContentLength,
  isJsonRequest,
} from "@/lib/server/api-security";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "帳號刪除服務尚未完成設定" }, { status: 503 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "登入狀態已失效，請重新登入" }, { status: 401 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "請使用 JSON 傳送確認資料" }, { status: 415 });
  }
  if (exceedsContentLength(request, 2048)) {
    return NextResponse.json({ error: "請求內容過大" }, { status: 413 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "登入狀態已失效，請重新登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "請輸入 DELETE 確認刪除帳號" }, { status: 400 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const rateLimited = await enforceRateLimit(admin, request, {
      scope: "account-delete",
      identity: authData.user.id,
      limit: 3,
      windowSeconds: 86400,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "安全驗證服務暫時無法使用" }, { status: 503 });
  }

  const { error: anonymizeError } = await admin.rpc("anonymize_account_for_deletion", {
    target_user_id: authData.user.id,
  });
  if (anonymizeError) {
    return NextResponse.json({ error: "帳號資料目前無法完成匿名化，請稍後再試" }, { status: 503 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(authData.user.id, true);
  if (deleteError) {
    return NextResponse.json(
      { error: "公開資料已停止顯示，但登入帳號尚未完成刪除；請稍後重試或聯絡平台" },
      { status: 503 },
    );
  }

  await admin
    .from("account_deletion_requests")
    .update({ status: "completed", auth_deleted_at: new Date().toISOString() })
    .eq("user_id", authData.user.id);

  return NextResponse.json({ deleted: true });
}
