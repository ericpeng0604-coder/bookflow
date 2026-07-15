import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isJsonRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

type ReviewBody = {
  verificationId?: unknown;
  decision?: unknown;
  note?: unknown;
};

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) {
    return NextResponse.json({ error: "請先登入管理員帳號" }, { status: 401 });
  }
  if (!isJsonRequest(request)) {
    return NextResponse.json({ error: "請使用 JSON 請求" }, { status: 415 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "登入狀態已失效，請重新登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as ReviewBody | null;
  const verificationId = typeof body?.verificationId === "string" ? body.verificationId : "";
  const decision = body?.decision === "approved" || body?.decision === "rejected" ? body.decision : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!verificationId || !decision || (decision === "rejected" && note.length < 2)) {
    return NextResponse.json({ error: "審核資料不完整" }, { status: 400 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,account_status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile || !["admin", "moderator"].includes(String(profile.role)) || profile.account_status !== "active") {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { data: verification, error: verificationError } = await admin
    .from("student_verifications")
    .select("id,image_path,status")
    .eq("id", verificationId)
    .maybeSingle();
  if (verificationError || !verification || verification.status !== "pending" || !verification.image_path) {
    return NextResponse.json({ error: "這筆學生證已處理或圖片不存在" }, { status: 409 });
  }

  const { error: storageError } = await admin.storage
    .from("student-verifications")
    .remove([verification.image_path]);
  if (storageError) {
    return NextResponse.json({ error: "學生證圖片清除失敗，審核未完成，請稍後重試" }, { status: 503 });
  }

  const { error: reviewError } = await authClient.rpc("review_student_verification", {
    target_id: verificationId,
    decision,
    note,
  });
  if (reviewError) {
    return NextResponse.json({ error: "圖片已清除，但審核狀態尚未更新，請再次按下審核" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
