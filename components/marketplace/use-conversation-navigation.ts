import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hideConversationWithSelection,
  markConversationReadLocally,
  markConversationReadWithRecovery,
  mergeConversationSummaries,
  removeConversation,
  resetConversationNavigationState,
  restoreConversationId,
} from "@/components/marketplace/conversation-navigation-policy";
import { markConversationRead } from "@/lib/marketplace/trade-chat";
import type { Conversation, Profile } from "@/lib/types";

const LAST_CHAT_KEY = "bookflow-last-chat-v1";
const lastChatStorageKey = (userId: string) => `${LAST_CHAT_KEY}:${userId}`;

type UseConversationNavigationOptions = {
  client: SupabaseClient | null;
  currentUser: Profile | null;
  onRefresh: () => Promise<void>;
  onToast: (message: string) => void;
};

function restorePageScroll(position: { x: number; y: number }) {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: position.y, left: position.x, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: position.y, left: position.x, behavior: "auto" }));
    window.setTimeout(() => window.scrollTo({ top: position.y, left: position.x, behavior: "auto" }), 120);
  });
}

export function useConversationNavigation({ client, currentUser, onRefresh, onToast }: UseConversationNavigationOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const [storedConversationId, setStoredConversationId] = useState<string | null>(null);

  const reset = useCallback(() => {
    const nextState = resetConversationNavigationState<Conversation>();
    setConversations(nextState.conversations);
    setExpandedConversationId(nextState.expandedConversationId);
    setStoredConversationId(nextState.storedConversationId);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      reset();
      return;
    }
    setStoredConversationId(window.localStorage.getItem(lastChatStorageKey(currentUser.id)));
  }, [currentUser, reset]);

  const onConversationsLoaded = useCallback((items: Conversation[]) => {
    setConversations((previous) => mergeConversationSummaries(previous, items));
  }, []);

  const lastConversationId = useMemo(
    () => restoreConversationId(storedConversationId, conversations),
    [conversations, storedConversationId],
  );

  const markReadLocally = useCallback((conversationId: string) => {
    setConversations((previous) => markConversationReadLocally(previous, conversationId));
  }, []);

  const markRead = useCallback(async (conversationId: string) => {
    markReadLocally(conversationId);
    if (!client || !currentUser) return;
    await markConversationReadWithRecovery(conversationId, {
      markRead: (id) => markConversationRead(client, id),
      refresh: onRefresh,
    });
  }, [client, currentUser, markReadLocally, onRefresh]);

  const openConversation = useCallback(async (conversationId: string, options: { preservePageScroll?: boolean } = {}) => {
    const preserveScroll = typeof window !== "undefined" && options.preservePageScroll
      ? { x: window.scrollX, y: window.scrollY }
      : null;
    setExpandedConversationId(conversationId);
    if (preserveScroll) restorePageScroll(preserveScroll);
    if (currentUser) {
      window.localStorage.setItem(lastChatStorageKey(currentUser.id), conversationId);
      setStoredConversationId(conversationId);
    }
    try {
      await markRead(conversationId);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Conversation read failed");
    }
  }, [currentUser, markRead, onToast]);

  const hideConversation = useCallback(async (conversationId: string) => {
    if (!client || !currentUser) return;
    try {
      await hideConversationWithSelection(conversationId, async (id) => {
        const { error } = await client.rpc("hide_closed_conversation", { target_conversation_id: id });
        if (error) throw error;
      });
      setExpandedConversationId(null);
      setStoredConversationId((storedId) => storedId === conversationId ? null : storedId);
      setConversations((previous) => removeConversation(previous, conversationId));
      onToast("Conversation hidden");
    } catch (error) {
      onToast(`Unable to hide conversation: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [client, currentUser, onToast]);

  return {
    conversations,
    expandedConversationId,
    lastConversationId,
    hideConversation,
    markRead,
    onConversationsLoaded,
    mergeConversations: onConversationsLoaded,
    openConversation,
    reset,
    setExpandedConversationId,
  };
}
