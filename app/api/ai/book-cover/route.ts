import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  BOOK_OCR_AI_ALLOWED_TYPES,
  BOOK_OCR_AI_DEFAULT_MODEL,
  BOOK_OCR_AI_MAX_FILE_BYTES,
  buildGeminiBookCoverRequest,
  extractGeminiOutputText,
  extractSafeProviderErrorCode,
  normalizeAiBookCover,
  parseBookCoverOutputText,
} from "@/lib/server/book-ocr-ai";
import {
  enforceRateLimit,
  exceedsContentLength,
  isFormDataRequest,
} from "@/lib/server/api-security";

export const runtime = "nodejs";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_DAILY_LIMIT = 20;

function configuredDailyLimit() {
  const value = Number(process.env.BOOK_OCR_AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 && value <= 100
    ? value
    : DEFAULT_DAILY_LIMIT;
}

async function authenticate(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceRoleKey || !token) return null;

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, userId: data.user.id };
}

export async function POST(request: Request) {
  const authenticated = await authenticate(request);
  if (!authenticated) {
    return NextResponse.json({ error: "請先登入再使用 AI 封面補強" }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "AI 封面補強尚未完成服務設定" }, { status: 503 });
  }
  if (!isFormDataRequest(request)) {
    return NextResponse.json({ error: "請使用 multipart/form-data 上傳圖片" }, { status: 415 });
  }
  if (exceedsContentLength(request, BOOK_OCR_AI_MAX_FILE_BYTES + 512 * 1024)) {
    return NextResponse.json({ error: "上傳內容過大" }, { status: 413 });
  }
  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim() || "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "缺少有效的請求識別碼" }, { status: 400 });
  }
  try {
    const rateLimited = await enforceRateLimit(authenticated.admin, request, {
      scope: "book-cover-ai",
      identity: authenticated.userId,
      limit: 30,
      windowSeconds: 3600,
    });
    if (rateLimited) return rateLimited;
  } catch {
    return NextResponse.json({ error: "AI 安全檢查暫時無法使用" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "無法讀取上傳內容" }, { status: 400 });
  }
  const image = form.get("image");
  const localOcrText = String(form.get("localOcrText") || "").slice(0, 4000);
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "請提供課本封面圖片" }, { status: 400 });
  }
  if (!BOOK_OCR_AI_ALLOWED_TYPES.has(image.type) || image.size > BOOK_OCR_AI_MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "圖片須為 5MB 以內的 JPG、PNG 或 WebP" },
      { status: 400 },
    );
  }

  const dailyLimit = configuredDailyLimit();
  const { data: quotaRows, error: quotaError } = await authenticated.admin.rpc(
    "reserve_book_ocr_quota",
    {
      target_user_id: authenticated.userId,
      request_key: idempotencyKey,
      daily_limit: dailyLimit,
    },
  );
  if (quotaError) {
    return NextResponse.json({ error: "AI 使用額度暫時無法確認" }, { status: 503 });
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    if (quota?.reservation_state && quota.reservation_state !== "exhausted") {
      return NextResponse.json(
        { error: "這次辨識請求已處理或仍在進行中，請重新選擇照片後再試" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `今天的 AI 封面補強額度已用完（每日 ${dailyLimit} 次）` },
      { status: 429 },
    );
  }
  const reservationId = String(quota.reservation_id || "");
  if (!reservationId) {
    return NextResponse.json({ error: "AI 使用額度暫時無法保留" }, { status: 503 });
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const model = process.env.BOOK_OCR_AI_MODEL?.trim() || BOOK_OCR_AI_DEFAULT_MODEL;
  const requestBody = buildGeminiBookCoverRequest({
    model,
    imageMimeType: image.type,
    imageBase64: bytes.toString("base64"),
    localOcrText,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let quotaFinalized = false;
  const admin = authenticated.admin;

  async function finalizeQuota(succeeded: boolean) {
    if (quotaFinalized) return;
    quotaFinalized = true;
    await admin.rpc("finalize_book_ocr_quota", {
      target_reservation_id: reservationId,
      succeeded,
    });
  }

  try {
    const aiResponse = await fetch(
      `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
      {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      },
    );
    const aiPayload = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      await finalizeQuota(false);
      const providerCode = extractSafeProviderErrorCode(aiPayload);
      const diagnostic = `（Gemini ${aiResponse.status}${providerCode ? `/${providerCode}` : ""}）`;
      return NextResponse.json(
        { error: `AI 封面補強暫時無法完成${diagnostic}` },
        { status: 502 },
      );
    }
    const outputText = extractGeminiOutputText(aiPayload);
    let structured: unknown;
    try {
      structured = parseBookCoverOutputText(outputText);
    } catch {
      await finalizeQuota(false);
      return NextResponse.json({ error: "AI 回傳格式無法辨識" }, { status: 502 });
    }
    const normalized = normalizeAiBookCover(structured);
    if (!normalized.usable) {
      await finalizeQuota(false);
      return NextResponse.json({
        draft: {},
        confidence: normalized.confidence,
        remaining: Number(quota.remaining ?? 0),
      });
    }
    await finalizeQuota(true);
    return NextResponse.json({
      draft: normalized.draft,
      confidence: normalized.confidence,
      remaining: Number(quota.remaining ?? 0),
    });
  } catch (error) {
    await finalizeQuota(false).catch(() => undefined);
    const message = error instanceof Error && error.name === "AbortError"
      ? "AI 封面補強逾時，請稍後重試"
      : "AI 封面補強連線失敗";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
