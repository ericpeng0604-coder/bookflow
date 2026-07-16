import type { SupabaseClient } from "@supabase/supabase-js";

type StudentCardAiResponse = { studentNumber?: string };

export async function recognizeStudentCardWithAi(
  client: SupabaseClient,
  file: File,
  localOcrText: string,
) {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("登入狀態已失效，請重新登入後再試");

  const body = new FormData();
  body.set("image", file);
  body.set("localOcrText", localOcrText.slice(0, 1000));
  const response = await fetch("/api/ai/student-card", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Idempotency-Key": crypto.randomUUID() },
    body,
  });
  const payload = await response.json().catch(() => ({})) as StudentCardAiResponse;
  if (!response.ok) {
    if (response.status === 401) throw new Error("登入狀態已失效，請重新登入後再試");
    if (response.status >= 500) throw new Error("目前無法完成辨識，請稍後再試");
    throw new Error("照片暫時無法辨識，請重新上傳清晰的學生證照片");
  }
  return { studentNumber: payload.studentNumber || "" };
}
