import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookOcrDraft } from "@/lib/marketplace/free-ocr";

type AiBookOcrResponse = {
  draft?: BookOcrDraft;
  confidence?: number;
  remaining?: number;
  error?: string;
};

export async function recognizeBookCoverWithAi(
  client: SupabaseClient,
  file: File,
  localOcrText: string,
) {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("登入狀態已失效，請重新登入後再試");

  const body = new FormData();
  body.set("image", file);
  body.set("localOcrText", localOcrText.slice(0, 4000));

  const response = await fetch("/api/ai/book-cover", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const payload = await response.json().catch(() => ({})) as AiBookOcrResponse;
  if (!response.ok) {
    throw new Error(payload.error || "AI 封面補強暫時無法使用");
  }
  return {
    draft: payload.draft ?? {},
    confidence: Number(payload.confidence ?? 0),
    remaining: Number(payload.remaining ?? 0),
  };
}
