import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_REFRESH_WINDOW_MS = 60_000;

async function getFreshAccessToken(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  const expiresAt = data.session?.expires_at ? data.session.expires_at * 1000 : 0;
  if (!error && data.session?.access_token && expiresAt > Date.now() + SESSION_REFRESH_WINDOW_MS) {
    return data.session.access_token;
  }

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error("登入狀態已失效，請重新登入後再審核");
  }
  return refreshed.session.access_token;
}

export async function reviewStudentVerificationWithStorage(
  client: SupabaseClient,
  verificationId: string,
  decision: "approved" | "rejected",
  note: string,
) {
  const requestReview = (accessToken: string) => fetch("/api/admin/student-verifications/review", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ verificationId, decision, note }),
  });

  let response = await requestReview(await getFreshAccessToken(client));
  if (response.status === 401) {
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error("登入狀態已失效，請重新登入後再審核");
    }
    response = await requestReview(refreshed.session.access_token);
  }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "學生證審核失敗");
}
