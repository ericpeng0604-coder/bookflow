"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  GraduationCap,
  Heart,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { demoBooks, demoProfiles, demoRequests, departments } from "@/lib/demo-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Book, BookStatus, Profile, PurchaseRequest, RequestStatus } from "@/lib/types";

const STORAGE_KEY = "bookflow-demo-v2";

type View = "home" | "book" | "dashboard";
type DashboardTab = "listings" | "requests" | "received";
type Modal = "login" | "bookForm" | "request" | null;

type Store = {
  books: Book[];
  requests: PurchaseRequest[];
  profiles: Profile[];
  currentUser: Profile | null;
};

const statusLabels: Record<BookStatus, string> = {
  available: "販售中",
  negotiating: "洽談中",
  sold: "已售出",
};

const requestLabels: Record<RequestStatus, string> = {
  pending: "等待回覆",
  accepted: "已接受",
  rejected: "已婉拒",
  cancelled: "已取消",
};

const blankBook: Omit<Book, "id" | "sellerId" | "createdAt" | "status"> = {
  title: "",
  author: "",
  isbn: "",
  department: "資訊工程學系",
  course: "",
  teacher: "",
  edition: "",
  condition: "書況良好",
  price: 0,
  imageUrl: "",
  meetup: "",
  description: "",
};

function loadStore(): Store {
  if (typeof window === "undefined") {
    return { books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null };
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return { books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null };
  try {
    return JSON.parse(saved) as Store;
  } catch {
    return { books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null };
  }
}

function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function timeAgo(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

export function MarketplaceApp() {
  const [store, setStore] = useState<Store>({ books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("全部科系");
  const [maxPrice, setMaxPrice] = useState("不限價格");
  const [modal, setModal] = useState<Modal>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("listings");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setStore(loadStore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !supabase) return;

    const syncUser = (user: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null) => {
      if (!user?.email) {
        setStore((previous) => ({ ...previous, currentUser: null }));
        return;
      }

      const metadata = user.user_metadata ?? {};
      const googleProfile: Profile = {
        id: user.id,
        email: user.email,
        name: String(metadata.full_name || metadata.name || user.email.split("@")[0]),
        department: String(metadata.department || "未設定"),
      };

      setStore((previous) => ({
        ...previous,
        profiles: previous.profiles.some((profile) => profile.id === googleProfile.id)
          ? previous.profiles.map((profile) => (profile.id === googleProfile.id ? googleProfile : profile))
          : [...previous.profiles, googleProfile],
        currentUser: googleProfile,
      }));
    };

    void supabase.auth.getSession().then(({ data }) => syncUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [ready]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return store.books
      .filter((book) => book.status !== "sold")
      .filter((book) => department === "全部科系" || book.department === department)
      .filter((book) => maxPrice === "不限價格" || book.price <= Number(maxPrice))
      .filter((book) =>
        !normalized
          ? true
          : [book.title, book.author, book.course, book.teacher, book.isbn]
              .join(" ")
              .toLowerCase()
              .includes(normalized),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [department, maxPrice, query, store.books]);

  const selectedBook = store.books.find((book) => book.id === selectedId) ?? null;
  const currentUser = store.currentUser;
  const profile = (id: string) => store.profiles.find((item) => item.id === id);

  function openBook(id: string) {
    setSelectedId(id);
    setView("book");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requireLogin(action: () => void) {
    if (!currentUser) {
      setModal("login");
      return;
    }
    action();
  }

  async function sendEmailCode(email: string) {
    if (!supabase) {
      return "請先完成 Supabase Email 驗證設定";
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) return error.message;
    setToast("驗證碼已寄出，請檢查 Gmail 收件匣");
    return null;
  }

  async function verifyEmailCode(email: string, token: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) return "驗證碼錯誤或已過期，請重新確認";
    setModal(null);
    setToast("Email 驗證成功，歡迎加入書流");
    return null;
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setStore((previous) => ({ ...previous, currentUser: null }));
    setView("home");
    setToast("已安全登出");
  }

  function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) return;
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(data.entries());
    const payload = {
      title: String(fields.title),
      author: String(fields.author),
      isbn: String(fields.isbn),
      department: String(fields.department),
      course: String(fields.course),
      teacher: String(fields.teacher),
      edition: String(fields.edition),
      condition: String(fields.condition),
      price: Number(fields.price),
      imageUrl: String(fields.imageUrl) || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=800&q=80",
      meetup: String(fields.meetup),
      description: String(fields.description),
    };

    setStore((previous) => ({
      ...previous,
      books: editingBook
        ? previous.books.map((book) => (book.id === editingBook.id ? { ...book, ...payload } : book))
        : [
            {
              ...payload,
              id: crypto.randomUUID(),
              sellerId: currentUser.id,
              status: "available",
              createdAt: new Date().toISOString(),
            },
            ...previous.books,
          ],
    }));
    setEditingBook(null);
    setModal(null);
    setView("dashboard");
    setDashboardTab("listings");
    setToast(editingBook ? "刊登內容已更新" : "書籍刊登成功");
  }

  function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !selectedBook) return;
    const message = String(new FormData(event.currentTarget).get("message") || "");
    const duplicate = store.requests.some(
      (request) =>
        request.bookId === selectedBook.id &&
        request.buyerId === currentUser.id &&
        ["pending", "accepted"].includes(request.status),
    );
    if (duplicate) {
      setToast("你已送出過購買意願");
      setModal(null);
      return;
    }
    setStore((previous) => ({
      ...previous,
      requests: [
        ...previous.requests,
        {
          id: crypto.randomUUID(),
          bookId: selectedBook.id,
          buyerId: currentUser.id,
          message,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setModal(null);
    setToast("購買意願已送出");
  }

  function respondToRequest(requestId: string, status: "accepted" | "rejected") {
    const target = store.requests.find((request) => request.id === requestId);
    if (!target) return;
    setStore((previous) => ({
      ...previous,
      books: previous.books.map((book) =>
        book.id === target.bookId && status === "accepted" ? { ...book, status: "negotiating" } : book,
      ),
      requests: previous.requests.map((request) => {
        if (request.id === requestId) return { ...request, status };
        if (status === "accepted" && request.bookId === target.bookId && request.status === "pending") {
          return { ...request, status: "rejected" };
        }
        return request;
      }),
    }));
    setToast(status === "accepted" ? "已接受意願，雙方聯絡資訊已開放" : "已婉拒這筆意願");
  }

  function updateBookStatus(bookId: string, status: BookStatus) {
    setStore((previous) => ({
      ...previous,
      books: previous.books.map((book) => (book.id === bookId ? { ...book, status } : book)),
    }));
    setToast(status === "sold" ? "已標示為售出" : "商品狀態已更新");
  }

  function deleteBook(bookId: string) {
    setStore((previous) => ({
      ...previous,
      books: previous.books.filter((book) => book.id !== bookId),
      requests: previous.requests.filter((request) => request.bookId !== bookId),
    }));
    setToast("刊登已下架");
  }

  function resetDemo() {
    const initial = { books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null };
    setStore(initial);
    setView("home");
    setToast("示範資料已重設");
  }

  const myListings = currentUser ? store.books.filter((book) => book.sellerId === currentUser.id) : [];
  const myRequests = currentUser ? store.requests.filter((request) => request.buyerId === currentUser.id) : [];
  const receivedRequests = currentUser
    ? store.requests.filter((request) => store.books.some((book) => book.id === request.bookId && book.sellerId === currentUser.id))
    : [];

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => setView("home")} aria-label="回首頁">
          <span className="brand-mark"><BookOpen size={23} /></span>
          <span><b>書流</b><small>BOOKFLOW</small></span>
        </button>
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>找課本</button>
          <button onClick={() => requireLogin(() => { setEditingBook(null); setModal("bookForm"); })}>我要賣書</button>
          <button onClick={() => requireLogin(() => setView("dashboard"))}>我的交易</button>
        </nav>
        <div className="header-actions">
          {currentUser ? (
            <>
              <button className="user-chip" onClick={() => setView("dashboard")}><UserRound size={17} />{currentUser.name}</button>
              <button className="icon-button" title="登出" onClick={() => void logout()}><LogOut size={18} /></button>
            </>
          ) : (
            <button className="login-button" onClick={() => setModal("login")}><UserRound size={17} />登入 / 註冊</button>
          )}
          <button className="mobile-menu"><Menu /></button>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="hero">
            <div className="hero-glow one" />
            <div className="hero-glow two" />
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> 學長姐的書，學弟妹的下一站</span>
              <h1>讓知識繼續流動，<br /><em>一本書也不浪費。</em></h1>
              <p>在校園裡找到你需要的課本，省下一筆，也讓學長姐的筆記繼續發揮價值。</p>
              <div className="hero-search">
                <Search size={21} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋書名、課程、老師或 ISBN..." />
                <button onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>開始找書</button>
              </div>
              <div className="hero-trust">
                <span><ShieldCheck size={16} /> 校園面交更安心</span>
                <span><MessageCircle size={16} /> 接受後交換聯絡方式</span>
                <span><GraduationCap size={16} /> 依課程快速找到課本</span>
              </div>
            </div>
            <div className="hero-art">
              <div className="book-stack">
                <div className="floating-note note-one">資料結構<br /><b>省下 $380</b></div>
                <div className="book book-a"><span>DATA<br />STRUCTURES</span></div>
                <div className="book book-b"><span>MANAGEMENT</span></div>
                <div className="book book-c"><span>ENGLISH<br />GRAMMAR</span></div>
                <div className="floating-note note-two"><Check size={16} /> 校內面交</div>
              </div>
            </div>
          </section>

          <section className="market" id="market">
            <div className="section-heading">
              <div><span className="section-kicker">LATEST LISTINGS</span><h2>最近上架的課本</h2></div>
              <button className="sell-cta" onClick={() => requireLogin(() => { setEditingBook(null); setModal("bookForm"); })}><Plus size={18} />刊登一本書</button>
            </div>
            <div className="filters">
              <label className="filter-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋課本..." /></label>
              <label><GraduationCap size={18} /><select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
              <label><span className="dollar">$</span><select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option>不限價格</option><option value="300">$300 以下</option><option value="500">$500 以下</option><option value="800">$800 以下</option></select><ChevronDown size={16} /></label>
              <button className="filter-icon" title="篩選"><SlidersHorizontal size={18} /></button>
            </div>
            <div className="result-line"><b>{filteredBooks.length}</b> 本課本正在等待新主人</div>
            <div className="book-grid">
              {filteredBooks.map((book) => (
                <article className="book-card" key={book.id} onClick={() => openBook(book.id)}>
                  <div className="card-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={book.imageUrl} alt={book.title} />
                    <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                    <button className="heart" aria-label="收藏" onClick={(event) => event.stopPropagation()}><Heart size={18} /></button>
                  </div>
                  <div className="card-body">
                    <span className="course-tag">{book.course}</span>
                    <h3>{book.title}</h3>
                    <p>{book.author} · {book.edition}</p>
                    <div className="card-meta"><span>{book.condition}</span><span><MapPin size={13} />{book.meetup}</span></div>
                    <div className="card-footer"><strong>{money(book.price)}</strong><small>{timeAgo(book.createdAt)}刊登</small></div>
                  </div>
                </article>
              ))}
            </div>
            {filteredBooks.length === 0 && <div className="empty"><BookOpen size={40} /><h3>還沒有符合的課本</h3><p>換個關鍵字或篩選條件看看。</p></div>}
          </section>
        </>
      )}

      {view === "book" && selectedBook && (
        <section className="detail-page">
          <button className="back-button" onClick={() => setView("home")}><ArrowLeft size={18} />返回找書</button>
          <div className="detail-grid">
            <div className="detail-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedBook.imageUrl} alt={selectedBook.title} />
              <span className={`status ${selectedBook.status}`}>{statusLabels[selectedBook.status]}</span>
            </div>
            <div className="detail-content">
              <span className="course-tag">{selectedBook.department} · {selectedBook.course}</span>
              <h1>{selectedBook.title}</h1>
              <p className="detail-author">{selectedBook.author} · {selectedBook.edition}</p>
              <strong className="detail-price">{money(selectedBook.price)}</strong>
              <div className="detail-facts">
                <div><small>書況</small><b>{selectedBook.condition}</b></div>
                <div><small>授課老師</small><b>{selectedBook.teacher}</b></div>
                <div><small>面交地點</small><b>{selectedBook.meetup}</b></div>
                <div><small>ISBN</small><b>{selectedBook.isbn || "未提供"}</b></div>
              </div>
              <div className="description"><h3>賣家說明</h3><p>{selectedBook.description}</p></div>
              <div className="seller-row">
                <span className="avatar">{profile(selectedBook.sellerId)?.name.slice(0, 1)}</span>
                <div><small>賣家</small><b>{profile(selectedBook.sellerId)?.name}</b><span>{profile(selectedBook.sellerId)?.department}</span></div>
              </div>
              {currentUser?.id === selectedBook.sellerId ? (
                <button className="primary wide" onClick={() => { setEditingBook(selectedBook); setModal("bookForm"); }}><Pencil size={18} />編輯我的刊登</button>
              ) : (
                <button
                  className="primary wide"
                  disabled={selectedBook.status !== "available"}
                  onClick={() => requireLogin(() => setModal("request"))}
                >
                  <MessageCircle size={18} />{selectedBook.status === "available" ? "我有興趣" : "目前洽談中"}
                </button>
              )}
              <p className="safety-note"><ShieldCheck size={15} />為保護隱私，賣家接受購買意願後才會顯示雙方 Email。</p>
            </div>
          </div>
        </section>
      )}

      {view === "dashboard" && currentUser && (
        <section className="dashboard">
          <div className="dashboard-head">
            <div><span className="section-kicker">MY BOOKFLOW</span><h1>嗨，{currentUser.name}</h1><p>管理你的刊登與購買意願。</p></div>
            <button className="primary" onClick={() => { setEditingBook(null); setModal("bookForm"); }}><Plus size={18} />刊登課本</button>
          </div>
          <div className="dashboard-tabs">
            <button className={dashboardTab === "listings" ? "active" : ""} onClick={() => setDashboardTab("listings")}>我的刊登 <span>{myListings.length}</span></button>
            <button className={dashboardTab === "requests" ? "active" : ""} onClick={() => setDashboardTab("requests")}>我送出的意願 <span>{myRequests.length}</span></button>
            <button className={dashboardTab === "received" ? "active" : ""} onClick={() => setDashboardTab("received")}>收到的意願 <span>{receivedRequests.length}</span></button>
          </div>

          {dashboardTab === "listings" && (
            <div className="dashboard-list">
              {myListings.map((book) => (
                <div className="listing-row" key={book.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={book.imageUrl} alt="" />
                  <div className="listing-main"><span className={`status ${book.status}`}>{statusLabels[book.status]}</span><h3>{book.title}</h3><p>{book.course} · {money(book.price)}</p></div>
                  <div className="row-actions">
                    {book.status === "negotiating" && <button onClick={() => updateBookStatus(book.id, "sold")}><Check size={16} />完成交易</button>}
                    <button onClick={() => { setEditingBook(book); setModal("bookForm"); }}><Pencil size={16} />編輯</button>
                    <button className="danger" onClick={() => deleteBook(book.id)}><Trash2 size={16} />下架</button>
                  </div>
                </div>
              ))}
              {myListings.length === 0 && <EmptyDashboard text="你還沒有刊登任何課本" />}
            </div>
          )}

          {dashboardTab === "requests" && (
            <div className="dashboard-list">
              {myRequests.map((request) => {
                const book = store.books.find((item) => item.id === request.bookId);
                const seller = book ? profile(book.sellerId) : null;
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <div className="request-icon"><MessageCircle /></div>
                    <div className="request-main"><span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span><h3>{book.title}</h3><p>「{request.message}」</p>{request.status === "accepted" && <div className="contact-box"><Check size={16} />賣家聯絡方式：<b>{seller?.email}</b></div>}</div>
                    <small>{timeAgo(request.createdAt)}</small>
                  </div>
                );
              })}
              {myRequests.length === 0 && <EmptyDashboard text="你還沒有送出購買意願" />}
            </div>
          )}

          {dashboardTab === "received" && (
            <div className="dashboard-list">
              {receivedRequests.map((request) => {
                const book = store.books.find((item) => item.id === request.bookId);
                const buyer = profile(request.buyerId);
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <span className="avatar">{buyer?.name.slice(0, 1)}</span>
                    <div className="request-main"><span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span><h3>{buyer?.name} 想買《{book.title}》</h3><p>「{request.message}」</p>{request.status === "accepted" && <div className="contact-box"><Check size={16} />買家聯絡方式：<b>{buyer?.email}</b></div>}</div>
                    {request.status === "pending" && <div className="request-actions"><button className="accept" onClick={() => respondToRequest(request.id, "accepted")}><Check size={16} />接受</button><button onClick={() => respondToRequest(request.id, "rejected")}><X size={16} />婉拒</button></div>}
                  </div>
                );
              })}
              {receivedRequests.length === 0 && <EmptyDashboard text="目前還沒有人送出購買意願" />}
            </div>
          )}
          <button className="reset-demo" onClick={resetDemo}>重設示範資料</button>
        </section>
      )}

      <footer><div className="brand footer-brand"><span className="brand-mark"><BookOpen size={20} /></span><span><b>書流</b><small>BOOKFLOW</small></span></div><p>讓每一本課本，都找到下一位需要它的人。</p><span>校園二手書交流平台 · Prototype 2026</span></footer>

      {modal === "login" && (
        <LoginModal
          configured={isSupabaseConfigured}
          onClose={() => setModal(null)}
          onSendCode={sendEmailCode}
          onVerifyCode={verifyEmailCode}
        />
      )}
      {modal === "bookForm" && <BookFormModal book={editingBook} onClose={() => { setModal(null); setEditingBook(null); }} onSubmit={saveBook} />}
      {modal === "request" && selectedBook && <RequestModal book={selectedBook} onClose={() => setModal(null)} onSubmit={sendRequest} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><div className="modal-heading"><span className="brand-mark"><BookOpen size={21} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div></div>;
}

function LoginModal({
  configured,
  onClose,
  onSendCode,
  onVerifyCode,
}: {
  configured: boolean;
  onClose: () => void;
  onSendCode: (email: string) => Promise<string | null>;
  onVerifyCode: (email: string, token: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onSendCode(email.trim());
    setLoading(false);
    if (message) {
      setError(message);
      return;
    }
    setStep("code");
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onVerifyCode(email.trim(), code.trim());
    setLoading(false);
    if (message) setError(message);
  }

  return (
    <ModalShell title="加入書流" subtitle="用 Email 驗證碼快速登入，不必記密碼" onClose={onClose}>
      <div className="email-login">
        <div className="auth-shield"><ShieldCheck size={24} /></div>
        {step === "email" ? (
          <>
            <h3>輸入你的 Gmail</h3>
            <p>我們會寄送一組 8 位數驗證碼，確認這個 Email 由你本人使用。</p>
            <form className="otp-form" onSubmit={requestCode}>
              <label>
                Email
                <input
                  autoFocus
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="yourname@gmail.com"
                  required
                />
              </label>
              <button className="primary wide" type="submit" disabled={loading || !configured}>
                {loading ? "寄送中..." : "寄送驗證碼"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h3>輸入 8 位數驗證碼</h3>
            <p>驗證碼已寄到 <b>{email}</b>。沒有看到時，請檢查垃圾郵件。</p>
            <form className="otp-form" onSubmit={confirmCode}>
              <label>
                驗證碼
                <input
                  autoFocus
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{8}"
                  minLength={8}
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="輸入 8 位數字"
                  required
                />
              </label>
              <button className="primary wide" type="submit" disabled={loading || code.length !== 8}>
                {loading ? "驗證中..." : "確認並登入"}
              </button>
              <button className="text-button" type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}>
                更換 Email 或重新寄送
              </button>
            </form>
          </>
        )}
        {error && <div className="auth-error">{error}</div>}
        {!configured && <div className="auth-warning">網站管理員尚未完成 Email 驗證設定，請先依照專案內的設定指南操作。</div>}
        <small><ShieldCheck size={13} />書流不會取得或儲存你的 Gmail 密碼。</small>
      </div>
    </ModalShell>
  );
}

function BookFormModal({ book, onClose, onSubmit }: { book: Book | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const value = book ?? blankBook;
  return <ModalShell title={book ? "編輯刊登" : "刊登一本課本"} subtitle="資料越完整，學弟妹越容易找到它" onClose={onClose}><form onSubmit={onSubmit} className="form book-form"><label className="full">書名<input name="title" required defaultValue={value.title} placeholder="例如：資料結構：使用 C++" /></label><label>作者<input name="author" required defaultValue={value.author} /></label><label>ISBN<input name="isbn" defaultValue={value.isbn} /></label><label>科系<select name="department" defaultValue={value.department}>{departments.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>課程<input name="course" required defaultValue={value.course} /></label><label>授課老師<input name="teacher" defaultValue={value.teacher} /></label><label>版本<input name="edition" defaultValue={value.edition} /></label><label>書況<select name="condition" defaultValue={value.condition}><option>近全新</option><option>書況良好</option><option>有筆記</option><option>使用痕跡明顯</option></select></label><label>價格（NT$）<input name="price" required type="number" min="0" defaultValue={value.price || ""} /></label><label className="full">面交地點<input name="meetup" required defaultValue={value.meetup} placeholder="例如：圖書館一樓" /></label><label className="full">封面圖片網址<input name="imageUrl" type="url" defaultValue={value.imageUrl} placeholder="留空會使用預設圖片" /></label><label className="full">書況說明<textarea name="description" required rows={3} defaultValue={value.description} /></label><button className="primary wide full" type="submit">{book ? "儲存變更" : "確認刊登"}</button></form></ModalShell>;
}

function RequestModal({ book, onClose, onSubmit }: { book: Book; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalShell title="送出購買意願" subtitle={`想購買《${book.title}》`} onClose={onClose}><form onSubmit={onSubmit} className="form"><div className="request-summary"><span>{book.condition}</span><b>{money(book.price)}</b><span><MapPin size={14} />{book.meetup}</span></div><label>給賣家的留言<textarea name="message" required rows={4} placeholder="介紹一下方便面交的時間，或想確認的書況..." /></label><button className="primary wide" type="submit"><MessageCircle size={17} />送出購買意願</button><p className="form-note">送出後不代表完成交易，請等待賣家接受。</p></form></ModalShell>;
}

function EmptyDashboard({ text }: { text: string }) {
  return <div className="empty small"><Clock3 size={34} /><h3>{text}</h3><p>新的進度會出現在這裡。</p></div>;
}
