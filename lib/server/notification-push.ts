import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { NotificationType } from "@/lib/types";

type PushNotificationRow = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  book_id: string | null;
  request_id: string | null;
  conversation_id: string | null;
  title: string;
  message: string;
  push_attempts: number;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const IMPORTANT_TYPES = new Set<NotificationType>([
  "trade_message",
  "request_created",
  "request_accepted",
  "request_rejected",
  "trade_completed",
  "order_reminder",
  "order_expired",
  "reservation_cancelled",
  "handoff_confirmation",
  "book_sold",
  "listing_lifecycle",
]);

function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is not configured");
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("APP_URL is invalid");
  return parsed.origin;
}

function notificationUrl(notification: PushNotificationRow) {
  const url = new URL(appUrl());
  if (notification.conversation_id) {
    url.searchParams.set("view", "dashboard");
    url.searchParams.set("tab", "chats");
    url.searchParams.set("conversation", notification.conversation_id);
  } else if (notification.request_id) {
    url.searchParams.set("view", "dashboard");
    url.searchParams.set(
      "tab",
      ["request_created", "order_reminder"].includes(notification.type) ? "received" : "requests",
    );
    url.searchParams.set("request", notification.request_id);
  } else if (notification.type === "listing_lifecycle") {
    url.searchParams.set("view", "dashboard");
    url.searchParams.set("tab", "listings");
  } else if (notification.book_id) {
    url.searchParams.set("view", "book");
    url.searchParams.set("book", notification.book_id);
  }
  return url.toString();
}

function configureWebPush() {
  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) throw new Error("Web Push is not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function deliverBrowserPush(
  admin: SupabaseClient,
  options?: { actorId?: string; since?: string; limit?: number },
) {
  configureWebPush();
  const now = new Date().toISOString();
  let query = admin
    .from("notifications")
    .select("id,recipient_id,type,book_id,request_id,conversation_id,title,message,push_attempts")
    .in("type", [...IMPORTANT_TYPES])
    .is("push_sent_at", null)
    .is("push_abandoned_at", null)
    .lt("push_attempts", 5)
    .or(`push_next_attempt_at.is.null,push_next_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 50);

  if (options?.actorId) query = query.eq("actor_id", options.actorId);
  if (options?.since) query = query.gte("created_at", options.since);

  const { data, error } = await query;
  if (error) throw error;
  const notifications = (data ?? []) as PushNotificationRow[];
  const recipientIds = [...new Set(notifications.map((item) => item.recipient_id))];
  const { data: subscriptionData, error: subscriptionError } = recipientIds.length
    ? await admin
        .from("push_subscriptions")
        .select("id,user_id,endpoint,p256dh,auth")
        .in("user_id", recipientIds)
        .eq("enabled", true)
    : { data: [], error: null };
  if (subscriptionError) throw subscriptionError;

  const subscriptions = new Map<string, PushSubscriptionRow[]>();
  for (const row of (subscriptionData ?? []) as PushSubscriptionRow[]) {
    subscriptions.set(row.user_id, [...(subscriptions.get(row.user_id) ?? []), row]);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of notifications) {
    const targets = subscriptions.get(notification.recipient_id) ?? [];
    if (targets.length === 0) {
      await admin.from("notifications").update({
        push_sent_at: now,
        push_last_error: "No active browser subscription",
        push_next_attempt_at: null,
      }).eq("id", notification.id).is("push_sent_at", null);
      skipped += 1;
      continue;
    }

    const claimUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: claimed } = await admin
      .from("notifications")
      .update({ push_next_attempt_at: claimUntil })
      .eq("id", notification.id)
      .is("push_sent_at", null)
      .or(`push_next_attempt_at.is.null,push_next_attempt_at.lte.${now}`)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    let delivered = false;
    const errors: string[] = [];
    for (const subscription of targets) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.message,
            url: notificationUrl(notification),
            tag: `bookflow-${notification.id}`,
          }),
          { TTL: 60 * 60 * 24, timeout: 15_000 },
        );
        delivered = true;
        await admin.from("push_subscriptions").update({
          failure_count: 0,
          last_success_at: new Date().toISOString(),
          last_error: "",
          updated_at: new Date().toISOString(),
        }).eq("id", subscription.id);
      } catch (sendError) {
        const statusCode = typeof sendError === "object" && sendError && "statusCode" in sendError
          ? Number((sendError as { statusCode?: unknown }).statusCode)
          : 0;
        const message = sendError instanceof Error ? sendError.message : "Unknown push error";
        errors.push(message);
        if ([404, 410].includes(statusCode)) {
          await admin.from("push_subscriptions").update({
            enabled: false,
            failure_count: 1,
            last_error: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          }).eq("id", subscription.id);
        } else {
          await admin.rpc("increment_push_subscription_failure", {
            target_subscription_id: subscription.id,
            error_message: message.slice(0, 500),
          });
        }
      }
    }

    if (delivered) {
      await admin.from("notifications").update({
        push_sent_at: new Date().toISOString(),
        push_last_error: "",
        push_next_attempt_at: null,
      }).eq("id", notification.id).is("push_sent_at", null);
      sent += 1;
    } else {
      const attempts = Number(notification.push_attempts || 0) + 1;
      const retryHours = Math.min(24, 2 ** Math.min(attempts, 4));
      await admin.from("notifications").update({
        push_attempts: attempts,
        push_last_error: errors.join("; ").slice(0, 500),
        push_next_attempt_at: attempts >= 5
          ? null
          : new Date(Date.now() + retryHours * 3600000).toISOString(),
        push_abandoned_at: attempts >= 5 ? new Date().toISOString() : null,
      }).eq("id", notification.id).is("push_sent_at", null);
      failed += 1;
    }
  }

  return { enabled: true, sent, failed, skipped };
}
