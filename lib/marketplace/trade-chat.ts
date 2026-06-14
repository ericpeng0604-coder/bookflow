import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradeMessage } from "@/lib/types";
import { compressImage } from "@/lib/marketplace/image-upload";

const CHAT_PAGE_SIZE = 50;
const MAX_CHAT_IMAGES_PER_MESSAGE = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAT_IMAGE_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export type TradeMessagePage = {
  messages: TradeMessage[];
  hasMore: boolean;
  nextCursor: { createdAt: string; id: string } | null;
};

function postgrestFilterLiteral(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function mapChatError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Too many messages")) return new Error("傳送太頻繁，請稍後再試");
  if (message.includes("Duplicate message")) return new Error("請勿重複傳送相同訊息");
  if (message.includes("Message content required")) return new Error("訊息不可為空");
  if (message.includes("Up to five images")) return new Error("每則訊息最多 5 張圖片");
  if (message.includes("Active conversation required")) return new Error("這個聊天室已結束或無法使用");
  if (message.includes("Conversation is blocked")) return new Error("你與對方已互相封鎖，無法傳送訊息");
  if (message.includes("Message too long")) return new Error("訊息不可超過 500 字");
  if (message.includes("Only your message can be recalled")) {
    return new Error("只能收回 10 分鐘內自己送出的訊息");
  }
  if (message.includes("Conversation participant required")) return new Error("無法更新聊聊已讀狀態");
  if (message.includes("JWT expired") || message.includes("Invalid JWT")) return new Error("登入已過期，請重新登入");
  if (message.includes("invalid input syntax for type uuid")) return new Error("聊天室資料異常，請重新整理");
  if (message.includes("部分圖片無法載入")) return new Error(message);
  if (message.includes("訊息已送出但無法取得伺服器回應")) return new Error(message);
  if (error instanceof Error && message) return error;
  return new Error("聊聊操作失敗，請稍後再試");
}

export function mapTradeMessage(row: Record<string, unknown>): TradeMessage {
  if (!row.id || !row.conversation_id || !row.sender_id || !row.created_at) {
    throw new Error("訊息格式不正確");
  }

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

function validateChatImagePaths(conversationId: string, paths: string[]) {
  if (paths.length > MAX_CHAT_IMAGES_PER_MESSAGE) {
    throw new Error("每則訊息最多 5 張圖片");
  }

  for (const path of paths) {
    if (!CHAT_IMAGE_PATH_PATTERN.test(path)) {
      throw new Error("圖片路徑格式不正確");
    }
    if (!path.startsWith(`${conversationId}/`)) {
      throw new Error("圖片路徑與目前聊天室不符");
    }
  }
}

export async function deleteChatImageUploads(client: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  await client.storage.from("chat-images").remove(paths);
}

export async function fetchTradeMessages(
  client: SupabaseClient,
  conversationId: string,
  cursor?: { createdAt: string; id: string } | null,
): Promise<TradeMessagePage> {
  if (!isUuid(conversationId)) {
    throw new Error("聊天室資料異常，請重新整理");
  }

  let query = client
    .from("trade_messages")
    .select("id,conversation_id,sender_id,body,image_paths,recalled_at,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_PAGE_SIZE + 1);

  if (cursor) {
    const createdAt = postgrestFilterLiteral(cursor.createdAt);
    const id = postgrestFilterLiteral(cursor.id);
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw mapChatError(error);

  const mapped = (data ?? []).map((row) => mapTradeMessage(row));
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
  if (!isUuid(conversationId)) {
    throw new Error("聊天室資料異常，請重新整理");
  }

  validateChatImagePaths(conversationId, imagePaths);

  const { data, error } = await client.rpc("send_chat_message", {
    target_conversation_id: conversationId,
    message_body: body.trim(),
    message_images: imagePaths,
  });
  if (error) throw mapChatError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("訊息已送出但無法取得伺服器回應，請重新整理");
  }

  return mapTradeMessage(row as Record<string, unknown>);
}

export async function markConversationRead(client: SupabaseClient, conversationId: string) {
  const { error } = await client.rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });
  if (error) throw mapChatError(error);
}

export async function recallTradeMessage(client: SupabaseClient, messageId: string) {
  const { error } = await client.rpc("recall_chat_message", { target_message_id: messageId });
  if (error) throw mapChatError(error);
}

export async function uploadChatImages(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
  files: File[],
) {
  if (files.length === 0) return [] as string[];
  if (files.length > MAX_CHAT_IMAGES_PER_MESSAGE) {
    throw new Error("每則訊息最多 5 張圖片");
  }
  if (!isUuid(conversationId) || !isUuid(userId)) {
    throw new Error("聊天室資料異常，請重新整理");
  }

  const paths: string[] = [];
  try {
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
      if (error) throw mapChatError(error);
      paths.push(path);
    }
    return paths;
  } catch (error) {
    await deleteChatImageUploads(client, paths).catch(() => undefined);
    throw mapChatError(error);
  }
}

export async function signChatImages(client: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;

  const { data, error } = await client.storage.from("chat-images").createSignedUrls(paths, 3600);
  if (error) throw mapChatError(error);

  const signed = Object.fromEntries(
    (data ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []),
  );
  const missing = paths.filter((path) => !signed[path]);
  if (missing.length > 0) {
    throw new Error("部分圖片無法載入，請稍後再試");
  }

  return signed;
}
