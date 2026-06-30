import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  exceedsContentLength,
  isJsonRequest,
} from "@/lib/server/api-security";

type JwtPayload = {
  session_id?: string;
  amr?: Array<string | { method?: string }>;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

function hasPasswordAuthentication(amr: JwtPayload["amr"]) {
  return Array.isArray(amr) && amr.some((entry) => {
    if (typeof entry === "string") return entry === "password";
    return entry?.method === "password";
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "管理員驗證服務尚未完成設定" }, { status: 503 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "登入狀態已失效，請重新登入" }, { status: 401 });
  }

  const payload = decodeJwtPayload(accessToken);
  if (!payload?.session_id || !hasPasswordAuthentication(payload.amr)) {
    return NextResponse.json({ error: "請先使用管理員密碼登入" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user?.email) {
    return NextResponse.json({ error: "登入狀態已失效，請重新登入" }, { status: 401 });
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("role,account_status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile.account_status !== "active") {
    return NextResponse.json({ error: "此帳號沒有管理員權限" }, { status: 403 });
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "請使用 JSON 傳送驗證碼" }, { status: 415 });
  }
  if (exceedsContentLength(request, 2048)) {
    return NextResponse.json({ error: "請求內容過大" }, { status: 413 });
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const rateLimited = await enforceRateLimit(admin, request, {
      scope: "admin-otp-verify",
      identity: authData.user.id,
      limit: 10,
      windowSeconds: 600,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "安全驗證服務暫時無法使用" }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{8}$/.test(code)) {
    return NextResponse.json({ error: "請輸入 8 位數驗證碼" }, { status: 400 });
  }

  const otpClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otpData, error: otpError } = await otpClient.auth.verifyOtp({
    email: authData.user.email,
    token: code,
    type: "email",
  });
  if (otpError || otpData.user?.id !== authData.user.id) {
    return NextResponse.json({ error: "驗證碼錯誤或已過期，請重新寄送" }, { status: 400 });
  }

  const { error: verificationError } = await admin
    .from("admin_login_verifications")
    .upsert({
      session_id: payload.session_id,
      user_id: authData.user.id,
      verified_at: new Date().toISOString(),
    });
  if (verificationError) {
    return NextResponse.json({ error: "無法完成管理員驗證，請稍後再試" }, { status: 500 });
  }

  return NextResponse.json({ verified: true });
}
