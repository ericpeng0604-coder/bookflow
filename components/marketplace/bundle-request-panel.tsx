"use client";

import { Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BundlePurchaseRequest, BundlePurchaseRequestItem, Profile } from "@/lib/types";

type BundleRow = BundlePurchaseRequest & { items: BundlePurchaseRequestItem[] };

type BundleRequestPanelProps = {
  client: SupabaseClient | null;
  currentUser: Profile;
  profiles: Profile[];
  onToast: (message: string) => void;
};

const statusLabels: Record<BundlePurchaseRequest["status"], string> = {
  draft: "草稿",
  pending: "待賣家處理",
  reserved: "已保留，等待雙方確認",
  rejected: "賣家已拒絕",
  cancelled: "已取消",
  expired: "已逾期",
  completed: "交易已完成",
};

function mapBundle(row: Record<string, unknown>): BundleRow {
  const rawItems = Array.isArray(row.bundle_purchase_request_items)
    ? row.bundle_purchase_request_items
    : [];
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    sellerId: String(row.seller_id),
    status: String(row.status) as BundlePurchaseRequest["status"],
    message: String(row.message || ""),
    preferredMeetupLocation: String(row.preferred_meetup_location || ""),
    preferredMeetupTime: String(row.preferred_meetup_time || ""),
    totalPriceSnapshot: Number(row.total_price_snapshot || 0),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    cancellationReason: String(row.cancellation_reason || ""),
    buyerConfirmedAt: row.buyer_confirmed_at ? String(row.buyer_confirmed_at) : null,
    sellerConfirmedAt: row.seller_confirmed_at ? String(row.seller_confirmed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
    items: rawItems.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({
      bundleId: String(row.id),
      bookId: String(item.book_id),
      position: Number(item.position || 0),
      itemStatus: String(item.item_status || "active") as BundlePurchaseRequestItem["itemStatus"],
      titleSnapshot: String(item.title_snapshot || "已下架商品"),
      priceSnapshot: Number(item.price_snapshot || 0),
      editionSnapshot: String(item.edition_snapshot || ""),
      imageSnapshot: String(item.image_snapshot || ""),
      meetupSnapshot: String(item.meetup_snapshot || ""),
    })),
  };
}

function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

export function BundleRequestPanel({ client, currentUser, profiles, onToast }: BundleRequestPanelProps) {
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const profileName = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.name])), [profiles]);

  const load = useCallback(async () => {
    if (!client) {
      setBundles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await client
      .from("bundle_purchase_requests")
      .select("id,buyer_id,seller_id,status,message,preferred_meetup_location,preferred_meetup_time,total_price_snapshot,expires_at,accepted_at,cancelled_at,cancellation_reason,buyer_confirmed_at,seller_confirmed_at,created_at,updated_at,bundle_purchase_request_items(bundle_id,book_id,position,item_status,title_snapshot,price_snapshot,edition_snapshot,image_snapshot,meetup_snapshot)")
      .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
      .neq("status", "draft")
      .order("updated_at", { ascending: false });
    if (error) {
      setBundles([]);
      onToast("合併購買意願目前無法載入");
    } else {
      setBundles((data || []).map((row) => mapBundle(row as Record<string, unknown>)));
    }
    setLoading(false);
  }, [client, currentUser.id, onToast]);

  useEffect(() => { void load(); }, [load]);

  async function callRpc(bundle: BundleRow, action: "accept" | "reject" | "cancel" | "confirm") {
    if (!client || savingId) return;
    setSavingId(bundle.id);
    const result = action === "accept" || action === "reject"
      ? await client.rpc("respond_to_bundle_purchase_request", { target_bundle_id: bundle.id, response: action === "accept" ? "accepted" : "rejected" })
      : action === "cancel"
        ? await client.rpc("cancel_bundle_purchase_request", { target_bundle_id: bundle.id, reason: "user_cancelled" })
        : await client.rpc("confirm_bundle_purchase_request", { target_bundle_id: bundle.id });
    setSavingId(null);
    if (result.error) {
      onToast(result.error.message || "合併購買意願操作失敗");
      return;
    }
    onToast(action === "accept" ? "已接受整筆合併意願" : action === "reject" ? "已拒絕整筆合併意願" : action === "confirm" ? "已送出完成確認" : "已取消整筆合併意願");
    await load();
  }

  if (loading) return <section className="bundle-dashboard-panel"><p>正在載入合併購買意願…</p></section>;
  if (bundles.length === 0) return null;

  return (
    <section className="bundle-dashboard-panel" aria-label="合併購買意願">
      <div className="dashboard-section-heading"><div><span className="section-kicker">BUNDLE REQUESTS</span><h2>合併購買意願</h2></div><button type="button" className="ghost" onClick={() => void load()}><RotateCcw size={15} />重新整理</button></div>
      <div className="bundle-dashboard-list">
        {bundles.map((bundle) => {
          const isSeller = bundle.sellerId === currentUser.id;
          const canRespond = isSeller && bundle.status === "pending";
          const canCancel = ["pending", "reserved"].includes(bundle.status);
          const canConfirm = bundle.status === "reserved";
          return (
            <article className="bundle-dashboard-card" key={bundle.id}>
              <div className="bundle-dashboard-card-head">
                <div><b>{isSeller ? `來自 ${profileName.get(bundle.buyerId) || "買家"}` : `賣家：${profileName.get(bundle.sellerId) || "賣家"}`}</b><small>{statusLabels[bundle.status]}</small></div>
                <strong>{money(bundle.totalPriceSnapshot)}</strong>
              </div>
              <ul className="bundle-dashboard-items">
                {bundle.items.map((item) => <li key={item.bookId} className={item.itemStatus !== "active" ? "unavailable" : ""}><span>{item.titleSnapshot}</span><b>{item.itemStatus === "active" ? money(item.priceSnapshot) : "目前無法購買"}</b></li>)}
              </ul>
              {bundle.message && <p className="bundle-dashboard-message">「{bundle.message}」</p>}
              {(bundle.preferredMeetupLocation || bundle.preferredMeetupTime) && <p className="bundle-dashboard-meetup">面交：{[bundle.preferredMeetupLocation, bundle.preferredMeetupTime].filter(Boolean).join(" · ")}</p>}
              <div className="bundle-dashboard-actions">
                {canRespond && <><button type="button" className="primary" disabled={savingId === bundle.id} onClick={() => void callRpc(bundle, "accept")}><Check size={16} />整批接受</button><button type="button" className="secondary-action" disabled={savingId === bundle.id} onClick={() => void callRpc(bundle, "reject")}><X size={16} />整批拒絕</button></>}
                {canConfirm && <button type="button" className="primary" disabled={savingId === bundle.id} onClick={() => void callRpc(bundle, "confirm")}>{savingId === bundle.id ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}確認交易完成</button>}
                {canCancel && <button type="button" className="secondary-action" disabled={savingId === bundle.id} onClick={() => void callRpc(bundle, "cancel")}><X size={16} />取消整筆合併單</button>}
                {savingId === bundle.id && <span className="bundle-action-status">處理中…</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}