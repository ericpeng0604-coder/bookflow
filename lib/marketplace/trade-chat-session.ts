"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TradeMessage } from "@/lib/types";
import {
  deleteChatImageUploads,
  fetchTradeMessages,
  mapTradeMessage,
  markConversationRead,
  recallTradeMessage,
  sendTradeMessage,
  signChatImages,
  uploadChatImages,
} from "@/lib/marketplace/trade-chat";

type MessageCursor = { createdAt: string; id: string } | null;

export type TradeChatSessionOptions = {
  client: SupabaseClient | null;
  conversationId: string;
  currentUserId: string;
  onRead?: (conversationId: string) => void;
};

export type TradeChatSession = {
  messages: TradeMessage[];
  imageUrls: Record<string, string>;
  loading: boolean;
  loadingOlder: boolean;
  hasOlderMessages: boolean;
  sending: boolean;
  error: string;
  sendMessage: (body: string, files: File[]) => Promise<TradeMessage | null>;
  loadOlderMessages: () => Promise<void>;
  recallMessage: (messageId: string) => Promise<void>;
};

function mergeMessages(previous: TradeMessage[], incoming: TradeMessage[]) {
  const known = new Set(previous.map((message) => message.id));
  return [
    ...incoming.filter((message) => !known.has(message.id)),
    ...previous,
  ];
}

export function useTradeChatSession({
  client,
  conversationId,
  currentUserId,
  onRead,
}: TradeChatSessionOptions): TradeChatSession {
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(client));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageCursorRef = useRef<MessageCursor>(null);
  const generationRef = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    const generation = ++generationRef.current;
    let active = true;
    const isCurrent = () => active && generationRef.current === generation;

    messageCursorRef.current = null;
    sendingRef.current = false;
    setMessages([]);
    setImageUrls({});
    setLoading(Boolean(client));
    setLoadingOlder(false);
    setHasOlderMessages(false);
    setSending(false);
    setError("");

    if (!client) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void fetchTradeMessages(client, conversationId)
      .then(async (page) => {
        if (!isCurrent()) return;
        setMessages(page.messages);
        setHasOlderMessages(page.hasMore);
        messageCursorRef.current = page.nextCursor;
        onRead?.(conversationId);

        try {
          await markConversationRead(client, conversationId);
        } catch (readError) {
          if (isCurrent()) {
            setError(readError instanceof Error ? readError.message : "無法更新已讀狀態");
          }
        }
        if (!isCurrent()) return;

        const paths = [...new Set(page.messages.flatMap((message) => message.imagePaths))];
        if (paths.length === 0) return;
        try {
          const signed = await signChatImages(client, paths);
          if (isCurrent()) setImageUrls(signed);
        } catch (signError) {
          if (isCurrent()) {
            setError(signError instanceof Error ? signError.message : "部分圖片無法載入");
          }
        }
      })
      .catch((loadError) => {
        if (!isCurrent()) return;
        setMessages([]);
        setError(loadError instanceof Error ? loadError.message : "無法載入聊聊");
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });

    const channel = client
      .channel(`trade-chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isCurrent()) return;
          let message: TradeMessage;
          try {
            message = mapTradeMessage(payload.new as Record<string, unknown>);
          } catch {
            return;
          }
          setMessages((previous) => previous.some((item) => item.id === message.id)
            ? previous
            : [...previous, message]);
          onRead?.(conversationId);
          void markConversationRead(client, conversationId).catch((readError) => {
            if (isCurrent()) {
              setError(readError instanceof Error ? readError.message : "無法更新已讀狀態");
            }
          });
          if (message.imagePaths.length === 0) return;
          void signChatImages(client, message.imagePaths)
            .then((signed) => {
              if (isCurrent()) setImageUrls((previous) => ({ ...previous, ...signed }));
            })
            .catch((signError) => {
              if (isCurrent()) {
                setError(signError instanceof Error ? signError.message : "部分圖片無法載入");
              }
            });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, conversationId, currentUserId, onRead]);

  const sendMessage = useCallback(async (body: string, files: File[]) => {
    if (!client || sendingRef.current || (!body.trim() && files.length === 0)) return null;

    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    sendingRef.current = true;
    setSending(true);
    setError("");
    let uploadedPaths: string[] = [];

    try {
      uploadedPaths = files.length > 0
        ? await uploadChatImages(client, conversationId, currentUserId, files)
        : [];
      const message = await sendTradeMessage(client, conversationId, body, uploadedPaths);
      if (!isCurrent()) return message;
      setMessages((previous) => previous.some((item) => item.id === message.id)
        ? previous
        : [...previous, message]);
      if (uploadedPaths.length > 0) {
        const signed = await signChatImages(client, uploadedPaths);
        if (isCurrent()) setImageUrls((previous) => ({ ...previous, ...signed }));
      }
      return message;
    } catch (sendError) {
      if (uploadedPaths.length > 0) {
        await deleteChatImageUploads(client, uploadedPaths).catch(() => undefined);
      }
      if (isCurrent()) {
        setError(sendError instanceof Error ? sendError.message : "訊息傳送失敗");
      }
      throw sendError;
    } finally {
      if (isCurrent()) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  }, [client, conversationId, currentUserId]);

  const loadOlderMessages = useCallback(async () => {
    const cursor = messageCursorRef.current;
    if (!client || !cursor || loadingOlder) return;

    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    setLoadingOlder(true);
    setError("");
    try {
      const page = await fetchTradeMessages(client, conversationId, cursor);
      if (!isCurrent()) return;
      setMessages((previous) => mergeMessages(previous, page.messages));
      setHasOlderMessages(page.hasMore);
      messageCursorRef.current = page.nextCursor;
      const paths = [...new Set(page.messages.flatMap((message) => message.imagePaths))];
      const signed = await signChatImages(client, paths);
      if (isCurrent()) setImageUrls((previous) => ({ ...previous, ...signed }));
    } catch (loadError) {
      if (isCurrent()) {
        setError(loadError instanceof Error ? loadError.message : "無法載入較早訊息");
      }
    } finally {
      if (isCurrent()) setLoadingOlder(false);
    }
  }, [client, conversationId, loadingOlder]);

  const recallMessage = useCallback(async (messageId: string) => {
    if (!client) return;
    try {
      await recallTradeMessage(client, messageId);
      setMessages((previous) => previous.map((message) =>
        message.id === messageId
          ? { ...message, body: "", recalledAt: new Date().toISOString() }
          : message,
      ));
    } catch (recallError) {
      setError(recallError instanceof Error ? recallError.message : "無法收回訊息");
    }
  }, [client]);

  return {
    messages,
    imageUrls,
    loading,
    loadingOlder,
    hasOlderMessages,
    sending,
    error,
    sendMessage,
    loadOlderMessages,
    recallMessage,
  };
}
