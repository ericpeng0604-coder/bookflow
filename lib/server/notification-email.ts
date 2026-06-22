import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationRow = {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  email_attempts: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function configuredAppUrl() {
  const value = process.env.APP_URL;
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function deliverNotificationEmails(
  admin: SupabaseClient,
  options?: { actorId?: string; since?: string; limit?: number },
) {
  const enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
  if (!enabled) return { enabled: false, sent: 0, failed: 0 };

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = configuredAppUrl();
  if (!resendKey || !from || !appUrl) {
    throw new Error("Email service is not configured");
  }

  let query = admin
    .from("notifications")
    .select("id,recipient_id,title,message,email_attempts")
    .is("email_sent_at", null)
    .is("email_abandoned_at", null)
    .lt("email_attempts", 5)
    .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 50);

  if (options?.actorId) query = query.eq("actor_id", options.actorId);
  if (options?.since) query = query.gte("created_at", options.since);

  const { data, error } = await query;
  if (error) throw error;
  const notifications = (data ?? []) as NotificationRow[];
  const recipientIds = [...new Set(notifications.map((notification) => notification.recipient_id))];
  const { data: recipients, error: recipientError } = recipientIds.length
    ? await admin.from("profiles").select("id,email").in("id", recipientIds)
    : { data: [], error: null };
  if (recipientError) throw recipientError;

  const recipientEmails = new Map(
    (recipients ?? []).map((recipient) => [String(recipient.id), String(recipient.email)]),
  );
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const email = recipientEmails.get(notification.recipient_id);
    if (!email) continue;

    const claimUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("notifications")
      .update({ email_next_attempt_at: claimUntil })
      .eq("id", notification.id)
      .is("email_sent_at", null)
      .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${new Date().toISOString()}`)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `虎科書流｜${notification.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.7;color:#17352f">
              <h2>${escapeHtml(notification.title)}</h2>
              <p>${escapeHtml(notification.message)}</p>
              <p><a href="${escapeHtml(appUrl)}" style="color:#16745f">開啟虎科書流查看詳情</a></p>
            </div>
          `,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);

      const { error: updateError } = await admin
        .from("notifications")
        .update({
          email_sent_at: new Date().toISOString(),
          email_last_error: "",
          email_next_attempt_at: null,
        })
        .eq("id", notification.id)
        .is("email_sent_at", null);
      if (updateError) throw updateError;
      sent += 1;
    } catch (error) {
      failed += 1;
      const attempts = Number(notification.email_attempts || 0) + 1;
      const retryHours = Math.min(24, 2 ** Math.min(attempts, 4));
      await admin
        .from("notifications")
        .update({
          email_attempts: attempts,
          email_last_error: error instanceof Error ? error.message.slice(0, 500) : "Unknown email error",
          email_next_attempt_at: attempts >= 5
            ? null
            : new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString(),
          email_abandoned_at: attempts >= 5 ? new Date().toISOString() : null,
        })
        .eq("id", notification.id)
        .is("email_sent_at", null);
    }
  }

  return { enabled: true, sent, failed };
}
