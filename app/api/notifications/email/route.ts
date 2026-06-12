import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function configuredAppUrl() {
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

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = configuredAppUrl();
  const enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !anonKey || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!enabled) {
    return NextResponse.json({ enabled: false, sent: 0 });
  }
  if (!serviceRoleKey || !resendKey || !from || !appUrl) {
    return NextResponse.json({ error: "Email service is not configured" }, { status: 503 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: notifications, error: notificationError } = await admin
    .from("notifications")
    .select("id,recipient_id,title,message")
    .eq("actor_id", authData.user.id)
    .is("email_sent_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20);

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 });
  }

  let sent = 0;
  const recipientIds = [...new Set((notifications ?? []).map((notification) => notification.recipient_id))];
  const { data: recipients, error: recipientError } = recipientIds.length
    ? await admin.from("profiles").select("id,email").in("id", recipientIds)
    : { data: [], error: null };

  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 500 });
  }

  const recipientEmails = new Map(
    (recipients ?? []).map((recipient) => [recipient.id, recipient.email]),
  );

  for (const notification of notifications ?? []) {
    const email = recipientEmails.get(notification.recipient_id);
    if (!email) continue;

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
    });

    if (!response.ok) continue;
    const { error: updateError } = await admin
      .from("notifications")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .is("email_sent_at", null);
    if (!updateError) sent += 1;
  }

  return NextResponse.json({ enabled: true, sent });
}
