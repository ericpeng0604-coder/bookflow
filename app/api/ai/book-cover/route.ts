import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  BOOK_OCR_AI_ALLOWED_TYPES,
  BOOK_OCR_AI_DEFAULT_MODEL,
  BOOK_OCR_AI_MAX_FILE_BYTES,
  buildGatewayBookCoverRequest,
  buildOpenAiBookCoverRequest,
  extractGatewayOutputText,
  extractOpenAiOutputText,
  extractSafeGatewayErrorCode,
  normalizeAiBookCover,
  parseBookCoverOutputText,
} from "@/lib/server/book-ocr-ai";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const VERCEL_AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
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

  const openAiKey = process.env.OPENAI_API_KEY;
  const gatewayToken = process.env.AI_GATEWAY_API_KEY
    || request.headers.get("x-vercel-oidc-token")
    || process.env.VERCEL_OIDC_TOKEN;
  if (!openAiKey && !gatewayToken) {
    return NextResponse.json({ error: "AI 封面補強尚未完成服務設定" }, { status: 503 });
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
    "consume_book_ocr_quota",
    { target_user_id: authenticated.userId, daily_limit: dailyLimit },
  );
  if (quotaError) {
    return NextResponse.json({ error: "AI 使用額度暫時無法確認" }, { status: 503 });
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return NextResponse.json(
      { error: `今天的 AI 封面補強額度已用完（每日 ${dailyLimit} 次）` },
      { status: 429 },
    );
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
  const model = process.env.BOOK_OCR_AI_MODEL?.trim() || BOOK_OCR_AI_DEFAULT_MODEL;
  const useGateway = !openAiKey;
  const requestBody = useGateway
    ? buildGatewayBookCoverRequest({ model, imageDataUrl, localOcrText })
    : buildOpenAiBookCoverRequest({ model, imageDataUrl, localOcrText });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const aiResponse = await fetch(
      useGateway ? VERCEL_AI_GATEWAY_URL : OPENAI_RESPONSES_URL,
      {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey || gatewayToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      },
    );
    const aiPayload = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      const providerCode = useGateway ? extractSafeGatewayErrorCode(aiPayload) : "";
      const diagnostic = useGateway
        ? `（Gateway ${aiResponse.status}${providerCode ? `/${providerCode}` : ""}）`
        : "";
      return NextResponse.json(
        { error: `AI 封面補強暫時無法完成${diagnostic}` },
        { status: 502 },
      );
    }
    const outputText = useGateway
      ? extractGatewayOutputText(aiPayload)
      : extractOpenAiOutputText(aiPayload);
    let structured: unknown;
    try {
      structured = parseBookCoverOutputText(outputText);
    } catch {
      return NextResponse.json({ error: "AI 回傳格式無法辨識" }, { status: 502 });
    }
    const normalized = normalizeAiBookCover(structured);
    if (!normalized.usable) {
      return NextResponse.json({
        draft: {},
        confidence: normalized.confidence,
        remaining: Number(quota.remaining ?? 0),
      });
    }
    return NextResponse.json({
      draft: normalized.draft,
      confidence: normalized.confidence,
      remaining: Number(quota.remaining ?? 0),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "AI 封面補強逾時，請稍後重試"
      : "AI 封面補強連線失敗";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
