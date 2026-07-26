"use client";

import Image from "next/image";
import { ArrowLeft, Check, LoaderCircle, MapPin, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapBook } from "@/lib/marketplace/mappers";
import type { Book, Profile } from "@/lib/types";

type SellerStorefrontProps = {
  sellerId: string;
  client: SupabaseClient | null;
  currentUser: Profile | null;
  onBack: () => void;
  onOpenBook: (bookId: string) => void;
  onRequireLogin: () => void;
  onToast: (message: string) => void;
};

type StorefrontCategory = "all" | "book" | "secondhand" | "giveaway";

type DraftSnapshot = {
  bookId: string;
  title: string;
  price: number;
  imageUrl: string;
  status: "active" | "unavailable";
};

const draftKey = (userId: string, sellerId: string) =>
  `bookflow-bundle-draft-v1:${userId}:${sellerId}`;

function readDraftIds(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SellerStorefront({
  sellerId,
  client,
  currentUser,
  onBack,
  onOpenBook,
  onRequireLogin,
  onToast,
}: SellerStorefrontProps) {
  const [seller, setSeller] = useState<{ id: string; name: string; department: string } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [draftSnapshots, setDraftSnapshots] = useState<DraftSnapshot[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [category, setCategory] = useState<StorefrontCategory>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupTime, setMeetupTime] = useState("");

  const storageUserId = currentUser?.id || "guest";
  const storageKey = draftKey(storageUserId, sellerId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSeller(null);
    setBooks([]);
    setDraftSnapshots([]);
    setSelectedIds(readDraftIds(storageKey));

    async function load() {
      if (!client) {
        if (active) setLoading(false);
        return;
      }
      const [profileResult, booksResult] = await Promise.all([
        client.rpc("get_public_seller_profile", { target_seller_id: sellerId }),
        client.rpc("list_seller_public_books", { target_seller_id: sellerId }),
      ]);
      if (!active) return;
      if (profileResult.error || booksResult.error) {
        setLoading(false);
        onToast("賣家賣場目前無法載入，請稍後再試");
        return;
      }
      const profileRow = profileResult.data?.[0];
      setSeller(profileRow ? {
        id: String(profileRow.id),
        name: String(profileRow.name || "賣家"),
        department: String(profileRow.department || ""),
      } : null);
      setBooks((booksResult.data || []).map((row: Record<string, unknown>) => mapBook(row)));

      if (currentUser) {
        const { data: draft } = await client
          .from("bundle_purchase_requests")
          .select("id")
          .eq("buyer_id", currentUser.id)
          .eq("seller_id", sellerId)
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (draft?.id) {
          const { data: items } = await client
            .from("bundle_purchase_request_items")
            .select("book_id,title_snapshot,price_snapshot,image_snapshot,item_status")
            .eq("bundle_id", draft.id)
            .order("position");
          if (active && items) {
            const snapshots = items.map((item) => ({
              bookId: String(item.book_id),
              title: String(item.title_snapshot || "已下架商品"),
              price: Number(item.price_snapshot || 0),
              imageUrl: String(item.image_snapshot || ""),
              status: item.item_status === "active" ? "active" : "unavailable",
            } satisfies DraftSnapshot));
            setDraftSnapshots(snapshots);
            setSelectedIds(snapshots.map((item) => item.bookId));
            window.localStorage.setItem(storageKey, JSON.stringify(snapshots.map((item) => item.bookId)));
          }
        }
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [client, currentUser, onToast, sellerId, storageKey]);

  const bookMap = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const selectedBooks = selectedIds
    .map((id) => bookMap.get(id))
    .filter((book): book is Book => Boolean(book));
  const unavailableSnapshots = draftSnapshots.filter((item) => !bookMap.has(item.bookId) || item.status === "unavailable");
  const missingSelectedIds = selectedIds.filter((id) => !bookMap.has(id) && !draftSnapshots.some((item) => item.bookId === id));
  const selectedUnavailable = selectedIds.filter((id) => {
    const book = bookMap.get(id);
    return !book || book.status !== "available";
  });
  const total = selectedBooks
    .filter((book) => book.status === "available")
    .reduce((sum, book) => sum + book.price, 0);

  const visibleBooks = useMemo(() => books.filter((book) => {
    if (category === "book") return book.listingType === "book";
    if (category === "secondhand") return book.listingType === "secondhand" && book.price > 0;
    if (category === "giveaway") return book.price === 0;
    return true;
  }), [books, category]);

  function persistIds(nextIds: string[]) {
    setSelectedIds(nextIds);
    window.localStorage.setItem(storageKey, JSON.stringify(nextIds));
  }

  function toggleBook(book: Book) {
    if (book.status !== "available") return;
    persistIds(selectedIds.includes(book.id)
      ? selectedIds.filter((id) => id !== book.id)
      : [...selectedIds, book.id]);
  }

  function removeBook(bookId: string) {
    persistIds(selectedIds.filter((id) => id !== bookId));
    setDraftSnapshots((previous) => previous.filter((item) => item.bookId !== bookId));
  }

  async function saveDraft() {
    if (!client || !currentUser || selectedIds.length === 0) return null;
    setSaving(true);
    const { data, error } = await client.rpc("save_bundle_draft", {
      target_seller_id: sellerId,
      target_book_ids: selectedIds,
    });
    setSaving(false);
    if (error) {
      onToast("合併清單暫存失敗，請稍後再試");
      return null;
    }
    return String(data);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    if (!client || selectedIds.length === 0 || selectedUnavailable.length > 0) return;
    setSubmitting(true);
    const bundleId = await saveDraft();
    if (!bundleId) {
      setSubmitting(false);
      return;
    }
    const { error } = await client.rpc("submit_bundle_purchase_request", {
      target_bundle_id: bundleId,
      request_message: message.trim(),
      preferred_meetup_location: meetupLocation.trim(),
      preferred_meetup_time: meetupTime.trim(),
    });
    setSubmitting(false);
    if (error) {
      onToast(error.message.includes("unavailable")
        ? "有商品已售出或下架，請先從清單移除"
        : "合併購買意願送出失敗，請稍後再試");
      return;
    }
    persistIds([]);
    setDraftSnapshots([]);
    setMessage("");
    onToast("合併購買意願已送出，等待賣家處理");
  }

  if (loading) {
    return (
      <section className="seller-storefront seller-storefront-loading" aria-busy="true">
        <div className="storefront-skeleton storefront-skeleton-head" />
        <div className="storefront-skeleton-grid">
          {[1, 2, 3, 4].map((item) => <div className="storefront-skeleton" key={item} />)}
        </div>
      </section>
    );
  }

  if (!seller) {
    return (
      <section className="seller-storefront">
        <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={18} />返回市場</button>
        <div className="empty">
          <ShoppingBag size={42} aria-hidden="true" />
          <h1>找不到這個賣場</h1>
          <p>賣家可能已停權，或目前沒有公開商品。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="seller-storefront">
      <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={18} />返回市場</button>
      <header className="seller-storefront-head">
        <div className="seller-storefront-avatar">{seller.name.slice(0, 1)}</div>
        <div>
          <span className="section-kicker">SELLER STORE</span>
          <h1>{seller.name} 的賣場</h1>
          {seller.department && <p>{seller.department}</p>}
        </div>
      </header>

      <nav className="seller-storefront-tabs" aria-label="賣場分類">
        {([
          ["all", "全部"],
          ["book", "二手書籍"],
          ["secondhand", "二手物品"],
          ["giveaway", "零元贈送"],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={category === value ? "active" : ""}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="seller-storefront-layout">
        <div className="seller-storefront-products">
          {visibleBooks.length === 0 ? (
            <div className="empty">
              <ShoppingBag size={36} aria-hidden="true" />
              <h2>這個分類目前沒有商品</h2>
              <p>可以切換其他分類看看。</p>
            </div>
          ) : (
            <ul className="seller-storefront-grid">
              {visibleBooks.map((book) => {
                const selected = selectedIds.includes(book.id);
                const unavailable = book.status !== "available";
                return (
                  <li className={`seller-storefront-card ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} key={book.id}>
                    <button type="button" className="seller-storefront-card-main" onClick={() => onOpenBook(book.id)}>
                      <div className="card-image">
                        <Image src={book.imageUrl} alt="" width={420} height={560} sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 260px" />
                        {unavailable && <span className="status negotiating">已被保留</span>}
                      </div>
                      <div className="card-body">
                        <span className="course-tag">{book.listingType === "secondhand" ? book.itemCategory : "二手書籍"}</span>
                        <h2>{book.title}</h2>
                        <p>{book.listingType === "secondhand" ? book.description : [book.author, book.edition].filter(Boolean).join(" · ")}</p>
                        <div className="card-footer"><strong>{formatMoney(book.price)}</strong><small><MapPin size={13} />{book.meetup}</small></div>
                      </div>
                    </button>
                    <label className="seller-storefront-select">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={unavailable}
                        onChange={() => toggleBook(book)}
                      />
                      <span>{unavailable ? "目前無法加入" : selected ? "已加入合併清單" : "加入合併清單"}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="bundle-draft-panel" aria-label="合併購買清單">
          <div className="bundle-draft-heading">
            <div><span className="section-kicker">BUNDLE</span><h2>合併購買清單</h2></div>
            <strong>{selectedIds.length}</strong>
          </div>
          {selectedUnavailable.length > 0 && (
            <div className="bundle-warning" role="alert">
              <b>有商品已售出或下架</b>
              <span>請逐項移除後才能送出。</span>
            </div>
          )}
          <div className="bundle-draft-items">
            {selectedBooks.map((book) => (
              <div className="bundle-draft-item" key={book.id}>
                <span>{book.title}</span><b>{formatMoney(book.price)}</b>
                <button type="button" aria-label={`移除 ${book.title}`} onClick={() => removeBook(book.id)}><X size={15} /></button>
              </div>
            ))}
            {missingSelectedIds.map((bookId) => (
              <div className="bundle-draft-item unavailable" key={bookId}>
                <span>已下架商品</span><b>已無法購買</b>
                <button type="button" aria-label="移除已下架商品" onClick={() => removeBook(bookId)}><X size={15} /></button>
              </div>
            ))}
            {unavailableSnapshots.filter((item) => selectedIds.includes(item.bookId)).map((item) => (
              <div className="bundle-draft-item unavailable" key={item.bookId}>
                <span>{item.title}</span><b>{item.status === "unavailable" ? "已無法購買" : formatMoney(item.price)}</b>
                <button type="button" aria-label={`移除 ${item.title}`} onClick={() => removeBook(item.bookId)}><X size={15} /></button>
              </div>
            ))}
            {selectedIds.length === 0 && <p className="bundle-empty">勾選商品後，會在這裡形成一筆合併購買意願。</p>}
          </div>
          {selectedIds.length > 0 && (
            <form className="bundle-submit-form" onSubmit={(event) => void submit(event)}>
              <div className="bundle-total"><span>商品合計</span><strong>{formatMoney(total)}</strong></div>
              <label>留言（選填）<textarea value={message} maxLength={500} rows={3} onChange={(event) => setMessage(event.target.value)} placeholder="想一起購買這些商品，想和你約時間面交。" /></label>
              <label>面交地點（選填）<input value={meetupLocation} maxLength={120} onChange={(event) => setMeetupLocation(event.target.value)} placeholder="例如：校門口" /></label>
              <label>面交時間（選填）<input value={meetupTime} maxLength={120} onChange={(event) => setMeetupTime(event.target.value)} placeholder="例如：平日下午" /></label>
              <button type="submit" className="primary wide" disabled={saving || submitting || selectedUnavailable.length > 0}>
                {saving || submitting ? <><LoaderCircle size={17} className="spin" />處理中…</> : <><Check size={17} />送出合併購買意願</>}
              </button>
              {!currentUser && <small className="bundle-login-note">送出時會要求使用 Google 登入，登入後會保留目前選取。</small>}
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
