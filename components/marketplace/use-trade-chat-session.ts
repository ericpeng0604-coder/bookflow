import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendTradeChatMessage, beginTradeChatSession, buildTradeChatPageState, prependOlderTradeMessages } from "@/components/marketplace/trade-chat-session-policy";
import { fetchTradeMessages, mapTradeMessage, recallTradeMessage, signChatImages } from "@/lib/marketplace/trade-chat";
import type { TradeMessage } from "@/lib/types";

type UseTradeChatSessionOptions = {
  client: SupabaseClient | null;
  conversationId: string;
  currentUserId: string;
  onRead: (conversationId: string) => void | Promise<void>;
  onMessageActivity?: (message: TradeMessage) => void;
};

export function useTradeChatSession({ client, conversationId, currentUserId, onRead, onMessageActivity }: UseTradeChatSessionOptions) {
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [showQuickPhrases, setShowQuickPhrases] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const cursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const sessionRef = useRef<ReturnType<typeof beginTradeChatSession> | null>(null);
  const tokenRef = useRef<number | null>(null);
  const onReadRef = useRef(onRead);
  const onMessageActivityRef = useRef(onMessageActivity);

  useEffect(() => {
    onReadRef.current = onRead;
    onMessageActivityRef.current = onMessageActivity;
  }, [onMessageActivity, onRead]);

  const reportError = useCallback((message: string) => setError(message), []);
  const retry = useCallback(() => setRetryKey((previous) => previous + 1), []);
  const addMessage = useCallback((message: TradeMessage) => {
    setMessages((previous) => appendTradeChatMessage(previous, message).messages);
  }, []);
  const addImageUrls = useCallback((nextImageUrls: Record<string, string>) => {
    setImageUrls((previous) => ({ ...previous, ...nextImageUrls }));
  }, []);
  const recallMessage = useCallback(async (messageId: string) => {
    if (!client) return;
    try {
      await recallTradeMessage(client, messageId);
      setMessages((previous) => previous.map((message) => message.id === messageId
        ? { ...message, body: "", recalledAt: new Date().toISOString() }
        : message));
    } catch (recallError) {
      reportError(recallError instanceof Error ? recallError.message : "Unable to recall message");
    }
  }, [client, reportError]);
  const loadOlderMessages = useCallback(async () => {
    const session = sessionRef.current;
    const token = tokenRef.current;
    const cursor = cursorRef.current;
    if (!session || token === null || !session.isCurrent(token) || !client || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchTradeMessages(client, conversationId, cursor);
      if (!session.isCurrent(token)) return;
      setMessages((previous) => prependOlderTradeMessages(previous, page.messages));
      setHasOlderMessages(page.hasMore);
      cursorRef.current = page.nextCursor;
      const paths = [...new Set(page.messages.flatMap((message) => message.imagePaths))];
      if (paths.length > 0) {
        const signed = await signChatImages(client, paths);
        if (session.isCurrent(token)) addImageUrls(signed);
      }
    } catch (loadError) {
      if (session.isCurrent(token)) reportError(loadError instanceof Error ? loadError.message : "Unable to load older messages");
    } finally {
      if (session.isCurrent(token)) setLoadingOlder(false);
    }
  }, [addImageUrls, client, conversationId, loadingOlder, reportError]);

  useEffect(() => {
    const session = beginTradeChatSession();
    const token = session.begin();
    sessionRef.current = session;
    tokenRef.current = token;
    cursorRef.current = null;
    setMessages([]); setImageUrls({}); setLoading(true); setLoadingOlder(false); setHasOlderMessages(false); setError("");
    if (!client) { setLoading(false); return () => session.dispose(); }
    void fetchTradeMessages(client, conversationId)
      .then(async (page) => {
        if (!session.isCurrent(token)) return;
        const state = buildTradeChatPageState(page, currentUserId);
        setMessages(state.messages); setHasOlderMessages(state.hasMore); cursorRef.current = state.nextCursor;
        try { await onReadRef.current(conversationId); } catch (readError) { if (session.isCurrent(token)) reportError(readError instanceof Error ? readError.message : "Conversation read failed"); }
        if (!session.isCurrent(token)) return;
        const paths = [...new Set(page.messages.flatMap((message) => message.imagePaths))];
        if (paths.length === 0) return;
        try { const signed = await signChatImages(client, paths); if (session.isCurrent(token)) setImageUrls(signed); }
        catch (signError) { if (session.isCurrent(token)) reportError(signError instanceof Error ? signError.message : "Unable to sign chat images"); }
      })
      .catch((loadError) => { if (session.isCurrent(token)) { setMessages([]); reportError(loadError instanceof Error ? loadError.message : "Unable to load messages"); } })
      .finally(() => { if (session.isCurrent(token)) setLoading(false); });
    const channel = client.channel(`trade-chat:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "trade_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      if (!session.isCurrent(token)) return;
      let message: TradeMessage;
      try { message = mapTradeMessage(payload.new as Record<string, unknown>); } catch { return; }
      addMessage(message);
      onMessageActivityRef.current?.(message);
      void Promise.resolve(onReadRef.current(conversationId)).catch((readError) => { if (session.isCurrent(token)) reportError(readError instanceof Error ? readError.message : "Conversation read failed"); });
      if (message.imagePaths.length > 0) void signChatImages(client, message.imagePaths).then((signed) => { if (session.isCurrent(token)) addImageUrls(signed); }).catch((signError) => { if (session.isCurrent(token)) reportError(signError instanceof Error ? signError.message : "Unable to sign chat images"); });
    }).subscribe();
    return () => { session.dispose(); void client.removeChannel(channel); };
  }, [addImageUrls, addMessage, client, conversationId, currentUserId, reportError, retryKey]);

  return { messages, imageUrls, loading, loadingOlder, hasOlderMessages, showQuickPhrases, setShowQuickPhrases, error, addImageUrls, addMessage, loadOlderMessages, recallMessage, retry, setError: reportError };
}
