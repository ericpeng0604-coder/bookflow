import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradeMessage } from "@/lib/types";
import { compressImage } from "@/lib/marketplace/image-upload";

const CHAT_PAGE_SIZE = 50;

export type TradeMessagePage = {
  messages: TradeMessage[];
  hasMore: boolean;
  nextCursor: { createdAt: string; id: string } | null;
};

function mapMessage(row: Record<string, unknown>): TradeMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: String(row.body || ""),
    imagePaths: Array.isArray(row.image_paths) ? row.image_paths.map(String) : [],
    recalledAt: row.recalled_at ? String(row.recalled_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function fetchTradeMessages(
  client: SupabaseClient,
  conversationId: string,
  cursor?: { createdAt: string; id: string } | null,
): Promise<TradeMessagePage> {
  let query = client
    .from("trade_messages")
    .select("id,conversation_id,sender_id,body,image_paths,recalled_at,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_PAGE_SIZE + 1);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  const mapped = (data ?? []).map((row) => mapMessage(row));
  const hasMore = mapped.length > CHAT_PAGE_SIZE;
  const page = (hasMore ? mapped.slice(0, CHAT_PAGE_SIZE) : mapped).reverse();
  const oldest = page[0];
  return {
    messages: page,
    hasMore,
    nextCursor: oldest ? { createdAt: oldest.createdAt, id: oldest.id } : null,
  };
}

export async function sendTradeMessage(
  client: SupabaseClient,
  conversationId: string,
  body: string,
  imagePaths: string[] = [],
) {
  const { data, error } = await client.rpc("send_chat_message", {
    target_conversation_id: conversationId,
    message_body: body.trim(),
    message_images: imagePaths,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return mapMessage(row as Record<string, unknown>);
}

export async function markConversationRead(client: SupabaseClient, conversationId: string) {
  const { error } = await client.rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function recallTradeMessage(client: SupabaseClient, messageId: string) {
  const { error } = await client.rpc("recall_chat_message", { target_message_id: messageId });
  if (error) throw error;
}

export async function uploadChatImages(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
  files: File[],
) {
  const paths: string[] = [];
  for (const file of files) {
    const compressed = await compressImage(file, {
      maxWidth: 1600,
      targetBytes: 1024 * 1024,
      outputName: "chat-image",
    });
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}.webp`;
    const { error } = await client.storage.from("chat-images").upload(path, compressed, {
      cacheControl: "31536000",
      upsert: false,
      contentType: compressed.type,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function signChatImages(client: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await client.storage.from("chat-images").createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries(
    data.flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []),
  );
}
