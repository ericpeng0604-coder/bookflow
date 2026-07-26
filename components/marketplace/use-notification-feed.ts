import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNotifications, fetchUnreadNotificationCount } from "@/lib/marketplace/queries";
import { isAbortError, runGuarded } from "@/lib/marketplace/refresh-guard";
import type { Notification, Profile } from "@/lib/types";

const NOTIFICATION_REFRESH_INTERVAL_MS = 120_000;

type UseNotificationFeedOptions = {
  client: SupabaseClient | null;
  currentUser: Profile | null;
  notificationOpen: boolean;
  onToast: (message: string) => void;
};

function unreadNotificationIds(items: Notification[]) {
  return items.filter((item) => !item.readAt).map((item) => item.id);
}

export function useNotificationFeed({ client, currentUser, notificationOpen, onToast }: UseNotificationFeedOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastRefreshRef = useRef(0);

  const reset = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    lastRefreshRef.current = 0;
  }, []);

  const refreshCount = useCallback(async () => {
    if (!client || !currentUser) return;
    try {
      const count = await fetchUnreadNotificationCount(client);
      setUnreadCount(count);
      lastRefreshRef.current = Date.now();
    } catch {
      // Preserve the last known badge during a transient network failure.
    }
  }, [client, currentUser]);

  const loadFeed = useCallback(async () => {
    if (!client || !currentUser) return;
    await runGuarded("notifications", async (signal) => {
      try {
        const items = await fetchNotifications(client);
        if (signal.aborted) return;
        setNotifications(items);
        const unreadIds = unreadNotificationIds(items);
        setUnreadCount(unreadIds.length);
        lastRefreshRef.current = Date.now();
        if (unreadIds.length === 0) return;

        const readAt = new Date().toISOString();
        const { error } = await client
          .from("notifications")
          .update({ read_at: readAt })
          .in("id", unreadIds)
          .is("read_at", null);
        if (signal.aborted) return;
        if (error) {
          onToast(`Unable to mark notifications read: ${error.message}`);
          return;
        }
        const unreadIdSet = new Set(unreadIds);
        setNotifications((previous) => previous.map((notification) =>
          unreadIdSet.has(notification.id) ? { ...notification, readAt } : notification,
        ));
        setUnreadCount(0);
      } catch (error) {
        if (!isAbortError(error)) {
          onToast(`Unable to load notifications: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    });
  }, [client, currentUser, onToast]);

  const markRead = useCallback(async (notificationId: string) => {
    if (!client || !currentUser) return;
    const readAt = new Date().toISOString();
    const { error } = await client
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId);
    if (error) {
      onToast(`Unable to mark notification read: ${error.message}`);
      return;
    }
    setNotifications((previous) => previous.map((notification) =>
      notification.id === notificationId ? { ...notification, readAt } : notification,
    ));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, [client, currentUser, onToast]);

  const markAllRead = useCallback(async () => {
    if (!client || !currentUser) return;
    const readAt = new Date().toISOString();
    const { error } = await client
      .from("notifications")
      .update({ read_at: readAt })
      .is("read_at", null);
    if (error) {
      onToast(`Unable to mark notifications read: ${error.message}`);
      return;
    }
    setNotifications((previous) => previous.map((notification) => ({
      ...notification,
      readAt: notification.readAt || readAt,
    })));
    setUnreadCount(0);
  }, [client, currentUser, onToast]);

  useEffect(() => {
    if (!client || !currentUser) {
      reset();
      return;
    }
    void refreshCount();
  }, [client, currentUser, refreshCount, reset]);

  useEffect(() => {
    if (!client || !currentUser) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshRef.current < NOTIFICATION_REFRESH_INTERVAL_MS) return;
      void refreshCount();
    };
    const interval = window.setInterval(refreshWhenVisible, NOTIFICATION_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [client, currentUser, refreshCount]);

  useEffect(() => {
    if (!notificationOpen || !client || !currentUser) return;
    void loadFeed();
  }, [client, currentUser, loadFeed, notificationOpen]);

  return { notifications, unreadCount, loadFeed, refreshCount, markRead, markAllRead, reset };
}
