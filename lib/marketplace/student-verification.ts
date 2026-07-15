import type { SupabaseClient } from "@supabase/supabase-js";

export async function reviewStudentVerificationWithStorage(
  client: SupabaseClient,
  verificationId: string,
  decision: "approved" | "rejected",
  note: string,
) {
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    throw new Error("登入狀態已失效，請重新登入後再審核");
  }

  const response = await fetch("/api/admin/student-verifications/review", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ verificationId, decision, note }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "學生證審核失敗");
}
