import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradeMessage } from "@/lib/types";

export async function fetchTradeMessages(client: SupabaseClient, requestId: string) {
  const { data, error } = await client
    .from("trade_messages")
    .select("id,request_id,sender_id,body,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    requestId: String(row.request_id),
    senderId: String(row.sender_id),
    body: String(row.body),
    createdAt: String(row.created_at),
  })) as TradeMessage[];
}

export async function sendTradeMessage(client: SupabaseClient, requestId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("訊息不可為空");
  const { data, error } = await client
    .from("trade_messages")
    .insert({ request_id: requestId, body: trimmed })
    .select("id,request_id,sender_id,body,created_at")
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    requestId: String(data.request_id),
    senderId: String(data.sender_id),
    body: String(data.body),
    createdAt: String(data.created_at),
  } as TradeMessage;
}
