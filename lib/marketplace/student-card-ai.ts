import type { SupabaseClient } from "@supabase/supabase-js";

type StudentCardAiResponse = { studentNumber?: string; confidence?: number; error?: string };

export async function recognizeStudentCardWithAi(
  client: SupabaseClient,
  file: File,
  localOcrText: string,
  requestKey = crypto.randomUUID(),
) {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("登入狀態已失效，請重新登入後再試");

  const body = new FormData();
  body.set("image", file);
  body.set("localOcrText", localOcrText.slice(0, 1000));
  const response = await fetch("/api/ai/student-card", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Idempotency-Key": requestKey },
    body,
  });
  const payload = await response.json().catch(() => ({})) as StudentCardAiResponse;
  if (!response.ok) throw new Error(payload.error || "AI 學生證辨識暫時無法使用");
  return { studentNumber: payload.studentNumber || "", confidence: Number(payload.confidence || 0) };
}
