import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradeMessage } from "@/lib/types";

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

export async function fetchTradeMessages(client: SupabaseClient, conversationId: string) {
  const { data, error } = await client
    .from("trade_messages")
    .select("id,conversation_id,sender_id,body,image_paths,recalled_at,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((row) => mapMessage(row));
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("圖片只支援 JPG、PNG、WebP，且每張不得超過 5MB");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("chat-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function signChatImage(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from("chat-images").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
