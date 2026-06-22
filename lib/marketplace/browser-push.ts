import type { SupabaseClient } from "@supabase/supabase-js";

export type BrowserPushState = "unsupported" | "denied" | "disabled" | "enabled";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const normalized = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

async function accessToken(client: SupabaseClient) {
  const { data } = await client.auth.getSession();
  return data.session?.access_token || null;
}

export function browserPushState(subscription: PushSubscription | null): BrowserPushState {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return subscription ? "enabled" : "disabled";
}

export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  void registration.update().catch(() => undefined);
  return registration.pushManager.getSubscription();
}

export async function enableBrowserPush(client: SupabaseClient) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("這個瀏覽器不支援推播通知");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("你尚未允許瀏覽器推播通知");

  const registration = await navigator.serviceWorker.register("/sw.js");
  void registration.update().catch(() => undefined);
  const keyResponse = await fetch("/api/notifications/push/public-key");
  if (!keyResponse.ok) throw new Error("推播服務尚未完成設定");
  const { publicKey } = await keyResponse.json() as { publicKey: string };
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(publicKey),
  });
  const token = await accessToken(client);
  if (!token) throw new Error("登入狀態已失效，請重新登入");
  const response = await fetch("/api/notifications/push/subscription", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || "無法儲存推播設定");
  }
  return subscription;
}

export async function disableBrowserPush(client: SupabaseClient) {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const token = await accessToken(client);
  if (token) {
    await fetch("/api/notifications/push/subscription", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }
  await subscription.unsubscribe();
}

export async function dispatchBrowserPush(client: SupabaseClient) {
  const token = await accessToken(client);
  if (!token) return;
  await fetch("/api/notifications/push/dispatch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}
