import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const JSON_CONTENT_TYPES = ["application/json", "application/problem+json"];

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function requestKey(...parts: Array<string | null | undefined>) {
  return createHash("sha256")
    .update(parts.filter(Boolean).join(":"))
    .digest("hex");
}

export function isJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return Boolean(contentType && JSON_CONTENT_TYPES.includes(contentType));
}

export function isFormDataRequest(request: Request) {
  return request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data") ?? false;
}

export function exceedsContentLength(request: Request, maxBytes: number) {
  const value = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(value) && value > maxBytes;
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  request: Request,
  options: {
    scope: string;
    identity?: string;
    limit: number;
    windowSeconds: number;
  },
) {
  const keyHash = requestKey(options.identity, requestIp(request));
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    rate_scope: options.scope,
    rate_key_hash: keyHash,
    request_limit: options.limit,
    window_seconds: options.windowSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const resetAt = new Date(String(row?.reset_at || Date.now() + options.windowSeconds * 1000));
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "請求過於頻繁，請稍後再試" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return null;
}

export function safeServerError(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}
