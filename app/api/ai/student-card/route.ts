import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  extractGeminiStudentCard,
  buildGeminiStudentCardRequest,
  STUDENT_CARD_AI_ALLOWED_TYPES,
  STUDENT_CARD_AI_DEFAULT_MODEL,
  STUDENT_CARD_AI_MAX_FILE_BYTES,
} from "@/lib/server/student-card-ai";
import { parseBookCoverOutputText } from "@/lib/server/book-ocr-ai";
import { enforceRateLimit, exceedsContentLength, isFormDataRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

async function authenticate(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) return null;
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { admin: createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }), userId: data.user.id };
}

export async function POST(request: Request) {
  const authenticated = await authenticate(request);
  if (!authenticated) return NextResponse.json({ error: "請先登入再使用 AI 學生證辨識" }, { status: 401 });
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "AI 學生證辨識尚未完成服務設定" }, { status: 503 });
  if (!isFormDataRequest(request)) return NextResponse.json({ error: "請使用 multipart/form-data 上傳圖片" }, { status: 415 });
  if (exceedsContentLength(request, STUDENT_CARD_AI_MAX_FILE_BYTES + 512 * 1024)) return NextResponse.json({ error: "上傳內容過大" }, { status: 413 });
  try {
    const limited = await enforceRateLimit(authenticated.admin, request, { scope: "student-card-ai", identity: authenticated.userId, limit: 5, windowSeconds: 3600 });
    if (limited) return limited;
  } catch {
    return NextResponse.json({ error: "AI 安全檢查暫時無法使用" }, { status: 503 });
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "無法讀取上傳內容" }, { status: 400 }); }
  const image = form.get("image");
  if (!(image instanceof File) || !STUDENT_CARD_AI_ALLOWED_TYPES.has(image.type) || image.size > STUDENT_CARD_AI_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "圖片須為 5MB 以內的 JPG、PNG 或 WebP" }, { status: 400 });
  }
  const model = process.env.STUDENT_CARD_AI_MODEL?.trim() || process.env.BOOK_OCR_AI_MODEL?.trim() || STUDENT_CARD_AI_DEFAULT_MODEL;
  const body = buildGeminiStudentCardRequest({
    model,
    imageMimeType: image.type,
    imageBase64: Buffer.from(await image.arrayBuffer()).toString("base64"),
    localOcrText: String(form.get("localOcrText") || ""),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "AI 學生證辨識暫時無法完成" }, { status: 502 });
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === "string" ? part.text : "").join("") || "";
    const normalized = extractGeminiStudentCard(parseBookCoverOutputText(text));
    return NextResponse.json({ studentNumber: normalized.usable ? normalized.studentNumber : "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "AbortError" ? "AI 學生證辨識逾時，請稍後重試" : "AI 學生證辨識連線失敗" }, { status: 502 });
  } finally { clearTimeout(timeout); }
}
