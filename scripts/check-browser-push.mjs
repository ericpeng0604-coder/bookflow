import fs from "node:fs";

const files = {
  migration: fs.readFileSync("supabase/browser-push-and-30-day-confirmation.sql", "utf8"),
  worker: fs.readFileSync("public/sw.js", "utf8"),
  delivery: fs.readFileSync("lib/server/notification-push.ts", "utf8"),
  subscription: fs.readFileSync("app/api/notifications/push/subscription/route.ts", "utf8"),
  cron: fs.readFileSync("app/api/cron/push/route.ts", "utf8"),
};

const required = [
  [files.migration, "create table if not exists public.push_subscriptions"],
  [files.migration, "dispatch-browser-push-hourly"],
  [files.migration, "bookflow_push_dispatch_secret"],
  [files.worker, "showNotification"],
  [files.worker, "notificationclick"],
  [files.delivery, "WEB_PUSH_VAPID_PRIVATE_KEY"],
  [files.delivery, "push_sent_at"],
  [files.subscription, "auth.getUser"],
  [files.cron, "PUSH_DISPATCH_SECRET"],
];

const missing = required.filter(([source, signal]) => !source.includes(signal)).map(([, signal]) => signal);
if (missing.length) throw new Error(`Browser push implementation is missing: ${missing.join(", ")}`);

console.log("Browser push structure checks passed.");
