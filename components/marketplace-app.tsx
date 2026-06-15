"use client";

import {
  ArrowLeft,
  Bell,
  Ban,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Ellipsis,
  GraduationCap,
  Heart,
  EyeOff,
  Flag,
  ImagePlus,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  RotateCcw,
  UserCog,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoBooks, demoProfiles, demoRequests, departments } from "@/lib/demo-data";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  BOOK_IMAGE_CACHE_CONTROL,
  compressBookImage,
  extractStoragePath,
} from "@/lib/marketplace/image-upload";
import {
  clearLegacyFavorites,
  legacyFavoritesNeedSync,
  readFavoriteIds,
} from "@/lib/marketplace/favorites";
import { isAllDepartments, NO_MAX_PRICE, buildMarketplaceFilters } from "@/lib/marketplace/filters";
import {
  type BrowserPushState,
  browserPushState,
  currentPushSubscription,
  disableBrowserPush,
  dispatchBrowserPush,
  enableBrowserPush,
} from "@/lib/marketplace/browser-push";
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
import {
  fetchBookById,
  fetchFavoriteIds,
  fetchMarketplacePage,
  fetchProfilesByIds,
  fetchUnreadNotificationCount,
  loadModerationData,
  loadWorkspaceTabData,
  mergeProfiles,
  fetchNotifications,
} from "@/lib/marketplace/queries";
import { isAbortError, runGuarded } from "@/lib/marketplace/refresh-guard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Book,
  BookStatus,
  Conversation,
  Notification,
  Profile,
  PurchaseRequest,
  Report,
  ReportReason,
  ReportTargetType,
  RequestStatus,
  ReviewStatus,
  SellerLifecycle,
  TradeContact,
  TradeMessage,
  UserRole,
} from "@/lib/types";

const STORAGE_KEY = "bookflow-market-v1";
const PUSH_PROMPT_KEY = "bookflow-push-prompt-seen-v1";
const pushPromptStorageKey = (userId: string) => `${PUSH_PROMPT_KEY}:${userId}`;

type View = "home" | "book" | "dashboard" | "admin";
type DashboardTab = "listings" | "chats" | "requests" | "received" | "favorites";
type Modal = "login" | "adminOtp" | "resetPassword" | "profile" | "bookForm" | "contactSettings" | "request" | "report" | null;

type Store = {
  books: Book[];
  requests: PurchaseRequest[];
  profiles: Profile[];
  currentUser: Profile | null;
};

const NOTIFICATION_REFRESH_INTERVAL_MS = 120_000;

const REQUEST_PHRASES = [
  "你好，我對這本書有興趣，方便約時間面交嗎？",
  "請問書況還有保留嗎？我想這週內完成交易。",
  "我可以在校內面交，請問你通常方便什麼時段？",
  "想確認一下是否有劃線或筆記，謝謝！",
];

const CHAT_PHRASES = [
  "你好，請問方便約什麼時間面交？",
  "我可以配合校內面交，請告訴我方便的地點。",
  "好的，謝謝，我會準時到。",
  "抱歉，我想調整面交時間，可以再討論嗎？",
];

const HIDDEN_REQUEST_MESSAGES = new Set(["通用語句提供選擇"]);

const statusLabels: Record<BookStatus, string> = {
  available: "販售中",
  negotiating: "已保留",
  sold: "已售出",
};

const requestLabels: Record<RequestStatus, string> = {
  pending: "等待賣家處理",
  waitlisted: "候補中",
  reserved: "賣家已選定",
  awaiting_confirmation: "等待買家確認",
  completed: "交易完成",
  rejected: "未被選定",
  cancelled: "已取消",
  expired: "已失效",
};

const reviewLabels: Record<ReviewStatus, string> = {
  pending: "待審核",
  approved: "已通過",
  rejected: "已拒絕",
};

const reportReasonLabels: Record<ReportReason, string> = {
  misleading: "資料不實",
  fraud: "疑似詐騙",
  duplicate: "重複刊登",
  harassment: "騷擾",
  no_show: "交易失約",
  other: "其他",
};

const blankBook: Omit<
  Book,
  | "id"
  | "sellerId"
  | "createdAt"
  | "status"
  | "reviewStatus"
  | "reviewNote"
  | "moderationVisibility"
  | "lifecycleState"
  | "listingConfirmedAt"
  | "archivedAt"
  | "archiveReason"
> = {
  title: "",
  author: "",
  department: "",
  course: "",
  teacher: "",
  edition: "",
  condition: "書況良好",
  price: 0,
  imageUrl: "",
  meetup: "",
  description: "",
  contactMethod: "none",
  contactValue: "",
};

function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function timeAgo(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function authErrorMessage(message: string, fallback: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Email 或密碼錯誤，請重新確認";
  if (normalized.includes("email not confirmed")) return "這個 Email 尚未完成驗證，請先完成註冊驗證";
  if (normalized.includes("user already registered") || normalized.includes("already been registered")) return "這個 Email 已經註冊，請直接登入";
  if (normalized.includes("password should be at least")) return "密碼至少需要 8 個字元";
  if (normalized.includes("signup is disabled")) return "目前暫停開放註冊";
  if (normalized.includes("rate limit") || normalized.includes("security purposes")) return "操作次數過多，請稍後再試";
  if (normalized.includes("expired") || normalized.includes("invalid token") || normalized.includes("token has expired")) {
    return "驗證碼錯誤或已過期，請重新寄送";
  }
  return fallback;
}

export function MarketplaceApp() {
  const [store, setStore] = useState<Store>({ books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [heroQuery, setHeroQuery] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  const [maxPrice, setMaxPrice] = useState(NO_MAX_PRICE);
  const [modal, setModal] = useState<Modal>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("listings");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOtpEmail, setAdminOtpEmail] = useState("");
  const [contacts, setContacts] = useState<Record<string, TradeContact>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string; label: string } | null>(null);
  const [marketplaceBooks, setMarketplaceBooks] = useState<Book[]>([]);
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(false);
  const [marketplaceCursor, setMarketplaceCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [requestBooks, setRequestBooks] = useState<Book[]>([]);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteBookCache, setFavoriteBookCache] = useState<Book[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Book[]>([]);
  const [hiddenBooks, setHiddenBooks] = useState<Book[]>([]);
  const [sellerLifecycle, setSellerLifecycle] = useState<SellerLifecycle | null>(null);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<string>>(() => new Set());
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [pushState, setPushState] = useState<BrowserPushState>("disabled");
  const [pushSaving, setPushSaving] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const bookSavingRef = useRef(false);
  const adminOtpRequestedRef = useRef<string | null>(null);
  const [bookSaving, setBookSaving] = useState(false);
  const lastNotificationRefreshRef = useRef(0);
  const debouncedQuery = useDebouncedValue(query, 300);

  const ensureAdminOtp = useCallback(async (email: string, force = false) => {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    if (!force && adminOtpRequestedRef.current === email) return null;

    adminOtpRequestedRef.current = email;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      adminOtpRequestedRef.current = null;
      return authErrorMessage(error.message, "管理員驗證碼寄送失敗，請稍後再試");
    }
    return null;
  }, []);

  const marketplaceFilters = useMemo(
    () => buildMarketplaceFilters(department, maxPrice, debouncedQuery),
    [department, maxPrice, debouncedQuery],
  );

  async function recoverAdminVerification(message: string, user: Profile | null) {
    const permissionExpired = message.includes("Verified admin permission required")
      || message.includes("Moderator permission required");
    if (!permissionExpired || user?.role !== "admin" || !supabase) return false;

    setAdminOtpEmail(user.email);
    setStore((previous) => ({ ...previous, currentUser: null }));
    setModal("adminOtp");
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setToast(error
      ? "管理員驗證已失效，請按「重新寄送驗證碼」後再試"
      : "管理員驗證已失效，新的 8 位驗證碼已寄出");
    return true;
  }

  const loadMarketplaceBooks = useCallback(async (options?: { append?: boolean }) => {
    if (!supabase) return;
    const client = supabase;
    const append = options?.append ?? false;
    await runGuarded("marketplace", async (signal) => {
      setMarketplaceLoading(true);
      try {
        const page = await fetchMarketplacePage(
          client,
          marketplaceFilters,
          append ? marketplaceCursor : null,
        );
        if (signal.aborted) return;
        setMarketplaceBooks((previous) => (append ? [...previous, ...page.books] : page.books));
        setMarketplaceHasMore(page.hasMore);
        setMarketplaceCursor(page.nextCursor);
      } catch (error) {
        if (!isAbortError(error)) {
          setToast(`讀取刊登失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      } finally {
        if (!signal.aborted) setMarketplaceLoading(false);
      }
    });
  }, [marketplaceCursor, marketplaceFilters]);

  const loadMarketplaceCount = useCallback(async () => {
    const params = new URLSearchParams();
    if (marketplaceFilters.department) params.set("department", marketplaceFilters.department);
    if (marketplaceFilters.maxPrice !== null) params.set("maxPrice", String(marketplaceFilters.maxPrice));
    if (marketplaceFilters.query) params.set("query", marketplaceFilters.query);
    try {
      const response = await fetch(`/api/marketplace/count?${params.toString()}`);
      if (!response.ok) throw new Error("count unavailable");
      const result = await response.json() as { count: number | null };
      if (result.count !== null) setMarketplaceCount(result.count);
    } catch {
      setMarketplaceCount((previous) => Math.max(previous, marketplaceBooks.length));
    }
  }, [marketplaceBooks.length, marketplaceFilters]);

  const loadUserWorkspace = useCallback(async (user: Profile, tab: DashboardTab) => {
    if (!supabase) return;
    const client = supabase;
    await runGuarded(`workspace:${tab}`, async (signal) => {
      try {
        const workspace = await loadWorkspaceTabData(client, tab);
        if (signal.aborted) return;
        if (workspace.myBooks) setMyBooks(workspace.myBooks);
        if (workspace.requestBooks) {
          setRequestBooks((previous) => [
            ...new Map([...previous, ...workspace.requestBooks!].map((book) => [book.id, book])).values(),
          ]);
          if (tab === "favorites") setFavoriteBookCache(workspace.requestBooks);
        }
        if (workspace.requests) {
          setStore((previous) => ({ ...previous, requests: workspace.requests!, currentUser: user }));
        }
        if (workspace.partyProfiles) {
          setStore((previous) => ({
            ...previous,
            profiles: mergeProfiles(
              previous.profiles,
              workspace.partyProfiles!,
              [],
              user,
            ),
            currentUser: user,
          }));
        }
        if (workspace.contacts) setContacts(workspace.contacts);
        if (workspace.sellerLifecycle !== undefined) setSellerLifecycle(workspace.sellerLifecycle);
        if (workspace.conversations) setConversations(workspace.conversations);
        if (workspace.favoriteIds) setFavoriteIds(new Set(workspace.favoriteIds));
      } catch (error) {
        if (!isAbortError(error)) {
          setToast(`讀取交易資料失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      }
    });
  }, []);

  const loadDashboardWorkspace = useCallback(async (user: Profile, tab: DashboardTab) => {
    const tabs = tab === "requests" || tab === "received"
      ? [tab]
      : [tab, "requests" as const];
    await Promise.all(tabs.map((targetTab) => loadUserWorkspace(user, targetTab)));
  }, [loadUserWorkspace]);

  const loadModerationPanel = useCallback(async (user: Profile) => {
    if (!supabase) return;
    const client = supabase;
    await runGuarded("moderation", async (signal) => {
      try {
        const data = await loadModerationData(client, user);
        if (signal.aborted) return;
        setPendingReviews(data.pendingReviews);
        setHiddenBooks(data.hiddenBooks);
        setReports(data.reports);
        if (data.adminProfiles.length > 0) {
          setStore((previous) => ({
            ...previous,
            profiles: mergeProfiles(previous.profiles, [], data.adminProfiles, previous.currentUser),
          }));
        }
      } catch (error) {
        if (await recoverAdminVerification(error instanceof Error ? error.message : "", user)) return;
        if (!isAbortError(error)) {
          setToast(`讀取審核資料失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      }
    });
  }, []);

  const loadNotificationFeed = useCallback(async () => {
    if (!supabase || !store.currentUser) return;
    const client = supabase;
    await runGuarded("notifications", async (signal) => {
      try {
        const items = await fetchNotifications(client);
        if (signal.aborted) return;
        setNotifications(items);
        setUnreadNotificationCount(items.filter((item) => !item.readAt).length);
        lastNotificationRefreshRef.current = Date.now();

        const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);
        if (unreadIds.length > 0) {
          const readAt = new Date().toISOString();
          const { error } = await client
            .from("notifications")
            .update({ read_at: readAt })
            .in("id", unreadIds)
            .is("read_at", null);
          if (signal.aborted) return;
          if (error) {
            setToast(`通知已載入，但無法更新已讀狀態：${error.message}`);
            return;
          }
          const unreadIdSet = new Set(unreadIds);
          setNotifications((previous) => previous.map((notification) =>
            unreadIdSet.has(notification.id) ? { ...notification, readAt } : notification
          ));
          setUnreadNotificationCount(0);
        }
      } catch (error) {
        if (!isAbortError(error)) {
          setToast(`讀取通知失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      }
    });
  }, [store.currentUser]);

  const loadNotificationCount = useCallback(async () => {
    if (!supabase || !store.currentUser) return;
    try {
      const count = await fetchUnreadNotificationCount(supabase);
      setUnreadNotificationCount(count);
      lastNotificationRefreshRef.current = Date.now();
    } catch {
      // Keep the last known badge value when the network is temporarily unavailable.
    }
  }, [store.currentUser]);

  const reloadAfterUserMutation = useCallback(async () => {
    if (!supabase || !store.currentUser) return;
    await Promise.all([
      loadDashboardWorkspace(store.currentUser, dashboardTab),
      loadMarketplaceBooks(),
    ]);
  }, [dashboardTab, loadDashboardWorkspace, loadMarketplaceBooks, store.currentUser]);

  const reloadAfterModerationMutation = useCallback(async () => {
    if (!supabase || !store.currentUser) return;
    await Promise.all([
      loadModerationPanel(store.currentUser),
      loadMarketplaceBooks(),
    ]);
  }, [loadMarketplaceBooks, loadModerationPanel, store.currentUser]);

  const openDashboard = useCallback(() => {
    setView("dashboard");
    if (view === "dashboard" && store.currentUser) {
      void loadDashboardWorkspace(store.currentUser, dashboardTab);
    }
  }, [dashboardTab, loadDashboardWorkspace, store.currentUser, view]);

  useEffect(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setFavoriteIds(readFavoriteIds());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !supabase) return;
    setMarketplaceCursor(null);
    setMarketplaceCount(0);
    void Promise.all([loadMarketplaceBooks(), loadMarketplaceCount()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, marketplaceFilters.department, marketplaceFilters.maxPrice, marketplaceFilters.query]);

  useEffect(() => {
    if (!ready || !supabase) return;
    const client = supabase;

    const syncUser = async (user: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null) => {
      if (!user?.email) {
        adminOtpRequestedRef.current = null;
        setStore((previous) => ({ ...previous, currentUser: null, requests: [] }));
        setMyBooks([]);
        setRequestBooks([]);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setContacts({});
        setSellerLifecycle(null);
        setSelectedArchivedIds(new Set());
        return;
      }

      const metadata = user.user_metadata ?? {};
      const { data: storedProfile } = await client
        .from("profiles")
        .select("id,name,email,department,role,account_status,suspended_at,suspension_reason")
        .eq("id", user.id)
        .maybeSingle();
      if (!storedProfile) {
        await client.auth.signOut();
        setStore((previous) => ({ ...previous, currentUser: null, requests: [] }));
        setMyBooks([]);
        setRequestBooks([]);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setContacts({});
        return;
      }
      const googleProfile: Profile = {
        id: user.id,
        email: user.email,
        name: storedProfile.name || String(metadata.full_name || metadata.name || user.email.split("@")[0]),
        department: storedProfile.department || String(metadata.department || "未設定"),
        role: (storedProfile.role || "user") as UserRole,
        accountStatus: (storedProfile.account_status || "active") as Profile["accountStatus"],
        suspendedAt: storedProfile.suspended_at || null,
        suspensionReason: storedProfile.suspension_reason || "",
      };

      await client.rpc("record_user_activity");

      if (legacyFavoritesNeedSync()) {
        const legacyIds = [...readFavoriteIds()];
        if (legacyIds.length > 0) {
          await client.from("favorites").upsert(
            legacyIds.map((bookId) => ({ user_id: user.id, book_id: bookId })),
            { onConflict: "user_id,book_id", ignoreDuplicates: true },
          );
        }
        clearLegacyFavorites();
      }

      if (googleProfile.role === "admin") {
        const { data: isVerified } = await client.rpc("is_verified_admin");
        if (!isVerified) {
          setAdminOtpEmail(user.email);
          setModal("adminOtp");
          setStore((previous) => ({ ...previous, currentUser: null }));
          const otpError = await ensureAdminOtp(user.email);
          setToast(otpError || "管理員驗證碼已寄出");
          return;
        }
      }

      adminOtpRequestedRef.current = null;
      setStore((previous) => ({
        ...previous,
        currentUser: googleProfile,
        profiles: mergeProfiles(previous.profiles, [], [], googleProfile),
      }));
      void fetchUnreadNotificationCount(client)
        .then(setUnreadNotificationCount)
        .catch(() => setUnreadNotificationCount(0));
      void fetchFavoriteIds(client)
        .then((ids) => setFavoriteIds(new Set(ids)))
        .catch(() => setFavoriteIds(new Set()));
    };

    void client.auth.getSession().then(({ data }) => void syncUser(data.session?.user ?? null));
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setModal("resetPassword");
      window.setTimeout(() => void syncUser(session?.user ?? null), 0);
    });

    return () => data.subscription.unsubscribe();
  }, [ready, ensureAdminOtp]);

  useEffect(() => {
    if (!supabase || !store.currentUser) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastNotificationRefreshRef.current < NOTIFICATION_REFRESH_INTERVAL_MS) return;
      void loadNotificationCount();
    };
    const interval = window.setInterval(refreshWhenVisible, NOTIFICATION_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [store.currentUser, loadNotificationCount]);

  useEffect(() => {
    if (!notificationOpen || !store.currentUser) return;
    void loadNotificationFeed();
  }, [notificationOpen, store.currentUser, loadNotificationFeed]);

  useEffect(() => {
    if (!supabase || !store.currentUser) {
      setShowPushPrompt(false);
      return;
    }
    void currentPushSubscription()
      .then((subscription) => {
        const state = browserPushState(subscription);
        setPushState(state);
        setShowPushPrompt(
          state === "disabled"
            && window.localStorage.getItem(pushPromptStorageKey(store.currentUser!.id)) !== "true",
        );
      })
      .catch(() => setPushState("unsupported"));
  }, [store.currentUser]);

  useEffect(() => {
    if (!ready || !store.currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const targetView = params.get("view");
    const targetTab = params.get("tab");
    const targetConversation = params.get("conversation");
    const targetBook = params.get("book");
    if (targetView === "dashboard") {
      setView("dashboard");
      if (["listings", "chats", "requests", "received", "favorites"].includes(targetTab || "")) {
        setDashboardTab(targetTab as DashboardTab);
      }
      if (targetConversation) {
        setExpandedConversationId(targetConversation);
        setConversations((previous) => previous.map((conversation) =>
          conversation.id === targetConversation ? { ...conversation, unreadCount: 0 } : conversation,
        ));
        if (supabase) {
          void markConversationRead(supabase, targetConversation).catch(() => {
            setToast("無法更新聊聊已讀狀態，請重新整理後再試");
          });
        }
      }
    } else if (targetView === "book" && targetBook) {
      setSelectedId(targetBook);
      setView("book");
    }
  }, [ready, store.currentUser]);

  useEffect(() => {
    if (!supabase || view !== "admin" || !store.currentUser) return;
    if (!["admin", "moderator"].includes(store.currentUser.role)) return;
    void loadModerationPanel(store.currentUser);
  }, [view, store.currentUser, loadModerationPanel]);

  useEffect(() => {
    if (!supabase || view !== "dashboard" || !store.currentUser) return;
    void loadDashboardWorkspace(store.currentUser, dashboardTab);
  }, [view, dashboardTab, store.currentUser, loadDashboardWorkspace]);

  useEffect(() => {
    if (!supabase || view !== "dashboard" || !store.currentUser) return;
    const refreshDashboardWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadDashboardWorkspace(store.currentUser!, dashboardTab);
    };
    document.addEventListener("visibilitychange", refreshDashboardWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshDashboardWhenVisible);
  }, [dashboardTab, loadDashboardWorkspace, store.currentUser, view]);

  useEffect(() => {
    if (!supabase || !selectedId || view !== "book") return;
    const knownBook = [
      ...marketplaceBooks,
      ...myBooks,
      ...requestBooks,
      ...pendingReviews,
      ...hiddenBooks,
      ...store.books,
    ].find((book) => book.id === selectedId);
    if (knownBook) {
      setDetailBook(knownBook);
      return;
    }
    setDetailBook(null);
    const client = supabase;
    const bookId = selectedId;
    void runGuarded("book-detail", async (signal) => {
      try {
        const book = await fetchBookById(client, bookId);
        if (signal.aborted) return;
        setDetailBook(book);
      } catch (error) {
        if (!isAbortError(error)) setDetailBook(null);
      }
    });
  }, [selectedId, view, marketplaceBooks, myBooks, requestBooks, pendingReviews, hiddenBooks, store.books]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 980) setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeMenu);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  async function dispatchNotificationDeliveries() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;
    await Promise.all([
      fetch("/api/notifications/email", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined),
      dispatchBrowserPush(supabase),
    ]);
  }

  async function enablePushNotifications() {
    if (!supabase || pushSaving) return;
    setPushSaving(true);
    try {
      await enableBrowserPush(supabase);
      setPushState("enabled");
      setShowPushPrompt(false);
      if (currentUser) window.localStorage.setItem(pushPromptStorageKey(currentUser.id), "true");
      setToast("瀏覽器推播已開啟");
    } catch (error) {
      const state = "Notification" in window && Notification.permission === "denied" ? "denied" : "disabled";
      setPushState(state);
      setToast(error instanceof Error ? error.message : "無法開啟瀏覽器推播");
    } finally {
      setPushSaving(false);
    }
  }

  async function disablePushNotifications() {
    if (!supabase || pushSaving) return;
    setPushSaving(true);
    try {
      await disableBrowserPush(supabase);
      setPushState("Notification" in window && Notification.permission === "denied" ? "denied" : "disabled");
      if (currentUser) window.localStorage.setItem(pushPromptStorageKey(currentUser.id), "true");
      setToast("瀏覽器推播已關閉");
    } finally {
      setPushSaving(false);
    }
  }

  function dismissPushPrompt() {
    if (currentUser) window.localStorage.setItem(pushPromptStorageKey(currentUser.id), "true");
    setShowPushPrompt(false);
  }

  const filteredBooks = useMemo(() => {
    if (supabase) return marketplaceBooks;
    const normalized = query.trim().toLowerCase();
    return store.books
      .filter((book) => book.reviewStatus === "approved")
      .filter((book) => book.moderationVisibility === "visible")
      .filter((book) => book.lifecycleState === "active")
      .filter((book) => book.status !== "sold")
      .filter((book) => isAllDepartments(department) || book.department === department)
      .filter((book) => !maxPrice || book.price <= Number(maxPrice))
      .filter((book) =>
        !normalized
          ? true
          : [book.title, book.author, book.course, book.teacher]
              .join(" ")
              .toLowerCase()
              .includes(normalized),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [department, maxPrice, query, store.books, marketplaceBooks]);

  const selectedBook = detailBook
    ?? filteredBooks.find((book) => book.id === selectedId)
    ?? myBooks.find((book) => book.id === selectedId)
    ?? requestBooks.find((book) => book.id === selectedId)
    ?? store.books.find((book) => book.id === selectedId)
    ?? null;
  const currentUser = store.currentUser;
  const profile = (id: string) => store.profiles.find((item) => item.id === id);

  useEffect(() => {
    if (!supabase || !selectedBook || view !== "book") return;
    if (store.profiles.some((item) => item.id === selectedBook.sellerId)) return;
    void fetchProfilesByIds(supabase, [selectedBook.sellerId])
      .then((profiles) => {
        setStore((previous) => ({
          ...previous,
          profiles: mergeProfiles(previous.profiles, profiles, [], previous.currentUser),
        }));
      })
      .catch(() => undefined);
  }, [selectedBook, view, store.profiles]);

  function openBook(id: string) {
    setSelectedId(id);
    setDetailBook(null);
    setDetailMenuOpen(false);
    setView("book");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitHeroSearch() {
    setQuery(heroQuery);
    setHeroQuery("");
    document.getElementById("market")?.scrollIntoView({ behavior: "smooth" });
  }

  function requireLogin(action: () => void) {
    if (!currentUser) {
      setModal("login");
      return;
    }
    action();
  }

  function requireActive(action: () => void) {
    requireLogin(() => {
      if (currentUser?.accountStatus === "suspended") {
        setToast("你的帳號目前為唯讀模式，無法進行這項操作");
        return;
      }
      action();
    });
  }

  async function loginWithPassword(email: string, password: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return authErrorMessage(error.message, "登入失敗，請稍後再試");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.role === "admin") {
      const otpError = await ensureAdminOtp(email);
      if (otpError) {
        await supabase.auth.signOut();
        return otpError;
      }
      setAdminOtpEmail(email);
      setModal("adminOtp");
      setToast("管理員驗證碼已寄出");
      return null;
    }
    setModal(null);
    setToast(profile?.account_status === "suspended" ? "已登入；你的帳號目前為唯讀模式" : "登入成功");
    return null;
  }

  async function loginWithGoogle() {
    if (!supabase) return "請先完成 Supabase 驗證設定";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return authErrorMessage(error.message, "Google 登入失敗，請稍後再試");
    return null;
  }

  async function verifyAdminOtp(code: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return "登入狀態已失效，請重新登入";

    const response = await fetch("/api/auth/admin-otp/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return result.error || "驗證碼錯誤或已過期";

    setToast("管理員身分驗證成功");
    window.location.reload();
    return null;
  }

  async function resendAdminOtp() {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const error = await ensureAdminOtp(adminOtpEmail, true);
    if (error) return error;
    setToast("新的管理員驗證碼已寄出");
    return null;
  }

  async function signUpWithPassword(name: string, department: string, email: string, password: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    if (!departments.slice(1).includes(department)) return "請從選單選擇正確的系所";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, department } },
    });
    if (error) return authErrorMessage(error.message, "註冊失敗，請稍後再試");
    if (data.user?.identities?.length === 0) return "這個 Email 已經註冊，請直接登入";
    setToast("註冊驗證碼已寄出，請檢查 Email 收件匣");
    return null;
  }

  async function verifySignupCode(email: string, token: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error) return authErrorMessage(error.message, "驗證碼錯誤或已過期，請重新確認");
    setModal(null);
    setToast("Email 驗證成功，歡迎加入虎科書流");
    return null;
  }

  async function resendSignupCode(email: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return authErrorMessage(error.message, "重新寄送失敗，請稍後再試");
    setToast("新的驗證碼已寄出");
    return null;
  }

  async function requestPasswordReset(email: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) return authErrorMessage(error.message, "無法寄送重設信，請稍後再試");
    setToast("密碼重設信已寄出，請檢查 Email 收件匣");
    return null;
  }

  async function updatePassword(password: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return authErrorMessage(error.message, "無法更新密碼，請重新開啟重設連結");
    setModal(null);
    setToast("密碼已更新，之後可使用新密碼登入");
    return null;
  }

  async function saveProfile(name: string, profileDepartment: string) {
    if (!supabase || !currentUser) return "目前無法更新個人資料";
    const trimmedName = name.trim();
    if (!trimmedName) return "請輸入姓名";
    if (trimmedName.length > 60) return "姓名不可超過 60 個字";
    if (!departments.slice(1).includes(profileDepartment)) return "請選擇系所";

    const { error } = await supabase
      .from("profiles")
      .update({ name: trimmedName, department: profileDepartment })
      .eq("id", currentUser.id);
    if (error) return `更新失敗：${error.message}`;

    await supabase.auth.updateUser({ data: { name: trimmedName, department: profileDepartment } });
    const updatedProfile = { ...currentUser, name: trimmedName, department: profileDepartment };
    setStore((previous) => ({
      ...previous,
      currentUser: updatedProfile,
      profiles: mergeProfiles(previous.profiles, [], [], updatedProfile),
    }));
    setModal(null);
    setToast("個人資料已更新");
    return null;
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setStore((previous) => ({ ...previous, requests: [], currentUser: null }));
    setMyBooks([]);
    setRequestBooks([]);
    setNotifications([]);
    setContacts({});
    setPendingReviews([]);
    setHiddenBooks([]);
    setDetailBook(null);
    setNotificationOpen(false);
    setMobileMenuOpen(false);
    setAdminOtpEmail("");
    setView("home");
    setToast("已安全登出");
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bookSavingRef.current) return;
    bookSavingRef.current = true;
    setBookSaving(true);

    try {
      if (!currentUser) return;
      if (currentUser.accountStatus === "suspended") {
        setToast("你的帳號目前為唯讀模式，不能刊登或修改商品");
        return;
      }
      const data = new FormData(event.currentTarget);
      const fields = Object.fromEntries(data.entries());
      const image = data.get("image");
      let imageUrl = editingBook?.imageUrl ?? "";
      let uploadedImagePath: string | null = null;

      if (image instanceof File && image.size > 0) {
        if (!supabase) {
          setToast("圖片上傳服務尚未完成設定");
          return;
        }
        try {
          const compressed = await compressBookImage(image);
          const extension = compressed.name.split(".").pop()?.toLowerCase() || "jpg";
          const filePath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("book-images")
            .upload(filePath, compressed, { cacheControl: BOOK_IMAGE_CACHE_CONTROL, upsert: false });

          if (uploadError) {
            setToast(`圖片上傳失敗：${uploadError.message}`);
            return;
          }

          imageUrl = supabase.storage.from("book-images").getPublicUrl(filePath).data.publicUrl;
          uploadedImagePath = filePath;
        } catch (error) {
          setToast(error instanceof Error ? error.message : "圖片處理失敗");
          return;
        }
      }

      if (!imageUrl) {
        setToast("請選擇一本書的封面圖片");
        return;
      }

      const payload = {
        title: String(fields.title),
        author: String(fields.author),
        department: String(fields.department),
        course: String(fields.course),
        teacher: String(fields.teacher),
        edition: String(fields.edition),
        condition: String(fields.condition),
        price: Number(fields.price),
        imageUrl,
        meetup: String(fields.meetup),
        description: String(fields.description),
        contactMethod: editingBook?.contactMethod ?? "none",
        contactValue: editingBook?.contactValue ?? "",
      };

      if (payload.department && !departments.slice(1).includes(payload.department)) {
        setToast("請從選單選擇正確的科系");
        return;
      }

      if (supabase) {
        const updatePayload = {
          title: payload.title,
          author: payload.author,
          department: payload.department,
          course: payload.course,
          teacher: payload.teacher,
          edition: payload.edition,
          condition: payload.condition,
          price: payload.price,
          image_url: payload.imageUrl,
          meetup: payload.meetup,
          description: payload.description,
        };
        const dbPayload = { seller_id: currentUser.id, ...updatePayload };
        const { error } = editingBook
          ? await supabase.from("books").update({ ...updatePayload, updated_at: new Date().toISOString() }).eq("id", editingBook.id)
          : await supabase.from("books").insert(dbPayload);

        if (error) {
          if (uploadedImagePath) {
            await supabase.storage.from("book-images").remove([uploadedImagePath]);
          }
          setToast(`刊登儲存失敗：${error.message}`);
          return;
        }
        if (editingBook && uploadedImagePath) {
          const oldImagePath = extractStoragePath(editingBook.imageUrl);
          if (oldImagePath && oldImagePath !== uploadedImagePath) {
            void supabase.storage.from("book-images").remove([oldImagePath]);
          }
        }
        await reloadAfterUserMutation();
        setEditingBook(null);
        setModal(null);
        setView("dashboard");
        setDashboardTab("listings");
        setToast(editingBook
          ? "修改已送回審核"
          : "刊登已送出。這次上架也已確認你目前公開的課本仍在販售，30 天後會再提醒。");
        return;
      }

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
                reviewStatus: "pending",
                reviewNote: "",
                moderationVisibility: "visible",
                lifecycleState: "active",
                listingConfirmedAt: new Date().toISOString(),
                archivedAt: null,
                archiveReason: "",
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
    } finally {
      bookSavingRef.current = false;
      setBookSaving(false);
    }
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !selectedBook) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能送出購買意願");
      return;
    }
    const message = String(new FormData(event.currentTarget).get("message") || "").trim();
    const duplicate = store.requests.find(
      (request) =>
        request.bookId === selectedBook.id &&
        request.buyerId === currentUser.id &&
        ["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status),
    );
    if (supabase) {
      let existingMessage = duplicate?.message;
      if (!duplicate) {
        const { data: existing, error: existingError } = await supabase
          .from("purchase_requests")
          .select("id,message,status")
          .eq("book_id", selectedBook.id)
          .eq("buyer_id", currentUser.id)
          .in("status", ["pending", "waitlisted", "reserved", "awaiting_confirmation"])
          .maybeSingle();
        if (existingError) {
          setToast(`無法確認既有購買意願：${existingError.message}`);
          return;
        }
        existingMessage = existing ? String(existing.message || "") : undefined;
      }
      if (existingMessage?.trim() === message) {
        setModal(null);
        setEditingRequest(null);
        setToast("已送出購買意願");
        return;
      }
      const { error } = await supabase.rpc("create_purchase_request", {
        target_book_id: selectedBook.id,
        request_message: message,
      });
      if (error) {
        setToast(error.code === "23505" ? "你已送出過購買意願" : `送出失敗：${error.message}`);
        return;
      }
      await reloadAfterUserMutation();
      void dispatchNotificationDeliveries();
      setModal(null);
      setEditingRequest(null);
      setToast("購買意願已送出");
      return;
    }
    if (duplicate) {
      if (duplicate.message.trim() === message) {
        setModal(null);
        setEditingRequest(null);
        setToast("已送出購買意願");
        return;
      }
      setStore((previous) => ({
        ...previous,
        requests: previous.requests.map((request) =>
          request.id === duplicate.id
            ? { ...request, message, updatedAt: new Date().toISOString() }
            : request,
        ),
      }));
      setModal(null);
      setEditingRequest(null);
      setToast("購買意願已送出");
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
          titleSnapshot: selectedBook.title,
          priceSnapshot: selectedBook.price,
          editionSnapshot: selectedBook.edition,
          imageSnapshot: selectedBook.imageUrl,
          meetupSnapshot: selectedBook.meetup,
          reservationExpiresAt: null,
          sellerHandoffAt: null,
          buyerConfirmedAt: null,
          cancelledAt: null,
          cancellationReason: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    setModal(null);
    setEditingRequest(null);
    setToast("購買意願已送出");
  }

  async function saveContactSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editingBook) return;

    const fields = new FormData(event.currentTarget);
    const method = String(fields.get("contactMethod") || "none") as Book["contactMethod"];
    const value = String(fields.get("contactValue") || "").trim();
    if (!["none", "email", "line"].includes(method)) {
      setToast("聯絡方式設定不正確");
      return;
    }
    if (method === "line" && !value) {
      setToast("請填寫 LINE ID");
      return;
    }

    const { error } = await supabase
      .from("book_contact_preferences")
      .upsert({
        book_id: editingBook.id,
        method,
        value: method === "line" ? value : "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "book_id" });
    if (error) {
      setToast(`聯絡方式儲存失敗：${error.message}`);
      return;
    }

    await reloadAfterUserMutation();
    setEditingBook(null);
    setModal(null);
    setToast(method === "none" ? "已關閉額外聯絡方式分享" : "聯絡方式設定已更新");
  }

  async function respondToRequest(requestId: string, status: "accepted" | "rejected") {
    if (currentUser?.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能操作交易");
      return;
    }
    const target = store.requests.find((request) => request.id === requestId);
    if (!target) return;
    if (supabase && currentUser) {
      const { error } = await supabase.rpc("respond_to_purchase_request", {
        request_id: requestId,
        response: status,
      });
      if (error) {
        setToast(`回覆失敗：${error.message}`);
        return;
      }
      await reloadAfterUserMutation();
      void dispatchNotificationDeliveries();
      setToast(status === "accepted" ? "已選定買家，保留期限為 7 天" : "已婉拒這筆請求");
      return;
    }
    setStore((previous) => ({
      ...previous,
      books: previous.books.map((book) =>
        book.id === target.bookId && status === "accepted" ? { ...book, status: "negotiating" } : book,
      ),
      requests: previous.requests.map((request) =>
        request.id === requestId
          ? { ...request, status: status === "accepted" ? "reserved" : "rejected" }
          : request,
      ),
    }));
    setToast(status === "accepted" ? "已接受意願，雙方聯絡資訊已開放" : "已婉拒這筆意願");
  }

  async function cancelRequest(requestId: string) {
    if (!currentUser) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能操作交易");
      return;
    }
    const reason = window.prompt("請填寫取消原因（至少 2 個字）");
    if (!reason?.trim()) return;
    if (supabase) {
      const { error } = await supabase.rpc("cancel_purchase_request", {
        target_request_id: requestId,
        reason: reason.trim(),
      });
      if (error) {
        setToast(`取消失敗：${error.message}`);
        return;
      }
      await reloadAfterUserMutation();
      void dispatchNotificationDeliveries();
      setToast("購買意願已取消");
      return;
    }
    setStore((previous) => ({
      ...previous,
      requests: previous.requests.map((request) =>
        request.id === requestId ? { ...request, status: "cancelled" } : request,
      ),
    }));
  }

  async function startConversation(bookId: string) {
    if (!supabase || !currentUser) return;
    const { data, error } = await supabase.rpc("start_conversation", { target_book_id: bookId });
    if (error) {
      setToast(`無法開啟聊聊：${error.message}`);
      return;
    }
    await loadUserWorkspace(currentUser, "chats");
    setView("dashboard");
    setDashboardTab("chats");
    void openConversation(String(data));
  }

  async function openOrderConversation(requestId: string) {
    if (!supabase || !currentUser) return;
    const { data, error } = await supabase.rpc("open_order_conversation", {
      target_request_id: requestId,
    });
    if (error) {
      setToast(`無法開啟聊聊：${error.message}`);
      return;
    }
    await loadUserWorkspace(currentUser, "chats");
    setView("dashboard");
    setDashboardTab("chats");
    void openConversation(String(data));
  }

  async function openConversation(conversationId: string) {
    setExpandedConversationId(conversationId);
    setConversations((previous) => previous.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
    ));
    if (!supabase || !currentUser) return;
    try {
      await markConversationRead(supabase, conversationId);
    } catch (error) {
      await loadUserWorkspace(currentUser, "chats");
      setToast(error instanceof Error ? error.message : "無法更新聊聊已讀狀態");
    }
  }

  const keepConversationRead = useCallback((conversationId: string) => {
    setConversations((previous) => previous.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
    ));
  }, []);

  async function sellerConfirmHandoff(requestId: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("seller_confirm_handoff", { target_request_id: requestId });
    if (error) {
      setToast(`更新失敗：${error.message}`);
      return;
    }
    await reloadAfterUserMutation();
    void dispatchNotificationDeliveries();
    setToast("已標記完成面交，等待買家確認");
  }

  async function buyerConfirmTrade(requestId: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("buyer_confirm_trade", { target_request_id: requestId });
    if (error) {
      setToast(`確認失敗：${error.message}`);
      return;
    }
    await reloadAfterUserMutation();
    void dispatchNotificationDeliveries();
    setToast("交易已完成");
  }

  function deleteBook(bookId: string) {
    if (currentUser?.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能修改刊登");
      return;
    }
    if (supabase && currentUser) {
      const client = supabase;
      void client.rpc("set_listing_lifecycle", {
        target_book_id: bookId,
        new_state: "withdrawn",
      }).then(async ({ error }) => {
        if (error) {
          setToast(`下架失敗：${error.message}`);
          return;
        }
        await reloadAfterUserMutation();
        setToast("刊登已下架，交易紀錄與圖片會依保留政策處理");
      });
      return;
    }
    setStore((previous) => ({
      ...previous,
      books: previous.books.filter((book) => book.id !== bookId),
      requests: previous.requests.filter((request) => request.bookId !== bookId),
    }));
    setToast("刊登已下架");
  }

  async function confirmAllListings() {
    if (!supabase || !currentUser || lifecycleSaving) return;
    setLifecycleSaving(true);
    try {
      const { error } = await supabase.rpc("confirm_all_active_listings");
      if (error) {
        setToast(`確認失敗：${error.message}`);
        return;
      }
      await reloadAfterUserMutation();
      setToast("已確認目前公開課本仍在販售，30 天後會再提醒");
    } finally {
      setLifecycleSaving(false);
    }
  }

  async function reviewArchivedListings(action: "keep" | "withdraw") {
    if (!supabase || selectedArchivedIds.size === 0 || lifecycleSaving) return;
    setLifecycleSaving(true);
    const selected = [...selectedArchivedIds];
    try {
      const { error } = await supabase.rpc("review_archived_listings", {
        keep_book_ids: action === "keep" ? selected : [],
        withdraw_book_ids: action === "withdraw" ? selected : [],
      });
      if (error) {
        setToast(`更新失敗：${error.message}`);
        return;
      }
      setSelectedArchivedIds(new Set());
      await reloadAfterUserMutation();
      setToast(action === "keep" ? "已恢復勾選的課本" : "已將勾選的課本正式下架");
    } finally {
      setLifecycleSaving(false);
    }
  }

  async function restoreWithdrawnListing(bookId: string) {
    if (!supabase || lifecycleSaving) return;
    setLifecycleSaving(true);
    try {
      const { error } = await supabase.rpc("set_listing_lifecycle", {
        target_book_id: bookId,
        new_state: "active",
      });
      if (error) {
        setToast(`恢復失敗：${error.message}`);
        return;
      }
      await reloadAfterUserMutation();
      setToast("課本已恢復販售");
    } finally {
      setLifecycleSaving(false);
    }
  }

  async function reviewBook(bookId: string, decision: "approved" | "rejected") {
    if (!supabase || !currentUser) return;
    const note = decision === "rejected"
      ? window.prompt("請輸入拒絕原因，賣家會看到這段說明：")?.trim()
      : "";
    if (decision === "rejected" && !note) return;

    const { error } = await supabase.rpc("review_book", {
      target_book_id: bookId,
      decision,
      note: note || "",
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`審核失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    void dispatchNotificationDeliveries();
    setToast(decision === "approved" ? "書籍已通過並公開上架" : "書籍已拒絕");
  }

  async function changeRole(userId: string, role: UserRole) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: userId,
      new_role: role,
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`權限更新失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    setToast("管理權限已更新");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUser || !reportTarget) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能送出檢舉");
      return;
    }
    const data = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("submit_report", {
      report_target_type: reportTarget.type,
      report_target_id: reportTarget.id,
      report_reason: String(data.get("reason")),
      report_details: String(data.get("details") || ""),
    });
    if (error) {
      setToast(error.message.includes("pending report")
        ? "你已對這個對象送出待處理檢舉"
        : `送出檢舉失敗：${error.message}`);
      return;
    }
    setModal(null);
    setReportTarget(null);
    setToast("檢舉已送交管理員審核");
  }

  function openReport(type: ReportTargetType, id: string, label: string) {
    requireActive(() => {
      if (id === currentUser?.id) {
        setToast("不能檢舉自己");
        return;
      }
      setReportTarget({ type, id, label });
      setModal("report");
    });
  }

  async function resolveReport(reportId: string, action: "dismiss" | "resolve" | "hide_book" | "suspend_user") {
    if (!supabase || !currentUser) return;
    const requiresReason = action === "hide_book" || action === "suspend_user";
    const note = window.prompt(
      requiresReason ? "請輸入處理原因（會顯示給受處分會員）" : "處理備註（可留空）",
    );
    if (note === null || (requiresReason && !note.trim())) return;
    const { error } = await supabase.rpc("resolve_report", {
      target_report_id: reportId,
      resolution_action: action,
      note: note.trim(),
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`處理檢舉失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    setToast(action === "dismiss" ? "檢舉已駁回" : "檢舉已處理");
  }

  async function changeAccountStatus(userId: string, status: Profile["accountStatus"]) {
    if (!supabase || !currentUser) return;
    const reason = status === "suspended"
      ? window.prompt("請輸入停權原因（會員仍可登入查看既有交易）")?.trim()
      : "";
    if (status === "suspended" && !reason) return;
    if (status === "active" && !window.confirm("確定要解除這個帳號的停權嗎？")) return;
    const { error } = await supabase.rpc("set_account_status", {
      target_user_id: userId,
      new_status: status,
      reason: reason || "",
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`更新帳號狀態失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    setToast(status === "active" ? "帳號已恢復使用" : "帳號已設為唯讀停權");
  }

  async function restoreBook(bookId: string) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.rpc("set_book_visibility", {
      target_book_id: bookId,
      new_visibility: "visible",
      reason: "管理員恢復刊登",
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`恢復刊登失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    setToast("刊登已恢復顯示");
  }

  async function markNotificationRead(notificationId: string) {
    if (!supabase || !currentUser) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId);
    if (error) {
      setToast(`通知更新失敗：${error.message}`);
      return;
    }
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === notificationId ? { ...notification, readAt } : notification,
      ),
    );
    setUnreadNotificationCount((count) => Math.max(0, count - 1));
  }

  async function markAllNotificationsRead() {
    if (!supabase || !currentUser) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .is("read_at", null);
    if (error) {
      setToast(`通知更新失敗：${error.message}`);
      return;
    }
    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, readAt: notification.readAt || readAt })),
    );
    setUnreadNotificationCount(0);
  }

  function openNotification(notification: Notification) {
    if (!notification.readAt) void markNotificationRead(notification.id);
    setNotificationOpen(false);
    setDetailMenuOpen(false);

    if (notification.type === "request_created") {
      setView("dashboard");
      setDashboardTab("received");
      return;
    }
    if (notification.type === "request_accepted" || notification.type === "request_rejected") {
      setView("dashboard");
      setDashboardTab("requests");
      return;
    }
    if (notification.type === "book_approved" || notification.type === "book_rejected" || notification.type === "book_hidden") {
      setView("dashboard");
      setDashboardTab("listings");
      return;
    }
    if (notification.type === "listing_lifecycle") {
      setView("dashboard");
      setDashboardTab("listings");
      return;
    }
    if (notification.type === "trade_completed") {
      setView("dashboard");
      setDashboardTab("listings");
      return;
    }
    if (notification.type === "trade_message") {
      setView("dashboard");
      setDashboardTab("chats");
      if (notification.conversationId) void openConversation(notification.conversationId);
      return;
    }
    if (notification.bookId) {
      setSelectedId(notification.bookId);
      setDetailBook(null);
      setView("book");
      return;
    }
    setView("dashboard");
  }

  async function toggleFavorite(bookId: string, event?: MouseEvent) {
    event?.stopPropagation();
    if (!store.currentUser) {
      setModal("login");
      return;
    }
    const wasFavorite = favoriteIds.has(bookId);
    if (supabase) {
      const result = wasFavorite
        ? await supabase.from("favorites").delete().eq("user_id", store.currentUser.id).eq("book_id", bookId)
        : await supabase.from("favorites").insert({ user_id: store.currentUser.id, book_id: bookId });
      if (result.error) {
        setToast(`收藏更新失敗：${result.error.message}`);
        return;
      }
    }
    setFavoriteIds((previous) => {
      const next = new Set(previous);
      if (wasFavorite) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
    setToast(wasFavorite ? "已取消收藏" : "已加入收藏");
  }

  const myListings = currentUser
    ? (supabase ? myBooks : store.books.filter((book) => book.sellerId === currentUser.id))
    : [];
  const knownBooks = supabase
    ? [...favoriteBookCache, ...marketplaceBooks, ...myBooks, ...requestBooks, ...pendingReviews, ...hiddenBooks]
    : store.books;
  const favoriteBooks = [...new Map(
    knownBooks
      .filter((book) => favoriteIds.has(book.id))
      .map((book) => [book.id, book]),
  ).values()];
  const myRequests = currentUser ? store.requests.filter((request) => request.buyerId === currentUser.id) : [];
  const receivedRequests = currentUser
    ? store.requests.filter((request) =>
        (supabase ? myBooks : store.books).some((book) => book.id === request.bookId && book.sellerId === currentUser.id),
      )
    : [];
  const isModerator = currentUser?.accountStatus === "active"
    && (currentUser.role === "admin" || currentUser.role === "moderator");
  const pendingReports = reports.filter((report) => report.status === "pending");
  const unreadNotifications = unreadNotificationCount;
  const activeAvailableListings = myListings.filter((book) => book.lifecycleState === "active" && book.status === "available");
  const archivedListings = myListings.filter((book) => book.lifecycleState === "archived");
  const nextConfirmationAt = sellerLifecycle
    ? new Date(new Date(sellerLifecycle.listingsConfirmedAt).getTime() + 30 * 86400000).toISOString()
    : null;
  const confirmationDue = Boolean(nextConfirmationAt && new Date(nextConfirmationAt).getTime() <= Date.now());

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => { setView("home"); setMobileMenuOpen(false); }} aria-label="回首頁">
          <span className="brand-mark"><BookOpen size={23} /></span>
          <span><b>虎科書流</b><small>HUST BOOKFLOW</small></span>
        </button>
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>找課本</button>
          <button onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}>我要賣書</button>
          <button onClick={() => requireLogin(openDashboard)}>我的交易</button>
          {isModerator && <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>審核後台</button>}
        </nav>
        <div className="header-actions">
          {currentUser ? (
            <>
              {isModerator && <button className="icon-button admin-shortcut" title="審核後台" onClick={() => setView("admin")}><UserCog size={18} /></button>}
              <div className="notification-wrap">
                <button
                  className="icon-button notification-button"
                  title="通知"
                  aria-label={`通知，${unreadNotifications} 則未讀`}
                  onClick={() => setNotificationOpen((open) => !open)}
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 && <span className="notification-count">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
                </button>
                {notificationOpen && (
                  <div className="notification-panel">
                    <div className="notification-head">
                      <div><b>通知</b><span>{unreadNotifications} 則未讀</span></div>
                      {unreadNotifications > 0 && <button onClick={() => void markAllNotificationsRead()}><CheckCheck size={15} />全部已讀</button>}
                    </div>
                    <div className="push-setting">
                      <div>
                        <b>瀏覽器推播</b>
                        <small>
                          {pushState === "enabled" && "已開啟重要交易與聊聊通知"}
                          {pushState === "disabled" && "目前關閉，站內通知仍會保留"}
                          {pushState === "denied" && "已被瀏覽器封鎖，請到網址列旁的權限設定開啟"}
                          {pushState === "unsupported" && "這個瀏覽器不支援推播"}
                        </small>
                      </div>
                      {pushState === "enabled" ? (
                        <button disabled={pushSaving} onClick={() => void disablePushNotifications()}>關閉</button>
                      ) : (
                        <button
                          disabled={pushSaving || pushState === "denied" || pushState === "unsupported"}
                          onClick={() => void enablePushNotifications()}
                        >
                          開啟
                        </button>
                      )}
                    </div>
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <button
                          className={`notification-item ${notification.readAt ? "" : "unread"}`}
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                        >
                          <span className="notification-dot" />
                          <span><b>{notification.title}</b><small>{notification.message}</small><time>{timeAgo(notification.createdAt)}</time></span>
                        </button>
                      ))}
                      {notifications.length === 0 && <div className="notification-empty"><Bell size={24} /><span>目前沒有通知</span></div>}
                    </div>
                  </div>
                )}
              </div>
              <button className="user-chip desktop-account-action" onClick={openDashboard}><UserRound size={17} />{currentUser.name}</button>
              <button className="icon-button desktop-account-action" title="登出" onClick={() => void logout()}><LogOut size={18} /></button>
            </>
          ) : (
            <button className="login-button desktop-account-action" onClick={() => setModal("login")}><UserRound size={17} />登入 / 註冊</button>
          )}
          <button
            className={`mobile-menu ${mobileMenuOpen ? "active" : ""}`}
            aria-label={mobileMenuOpen ? "關閉選單" : "開啟選單"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              setNotificationOpen(false);
              setMobileMenuOpen((open) => !open);
            }}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}>
            <div id="mobile-navigation" className="mobile-nav" onClick={(event) => event.stopPropagation()}>
              <button
                className={view === "home" ? "active" : ""}
                onClick={() => { setView("home"); setMobileMenuOpen(false); }}
              >
                找課本
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  requireActive(() => { setEditingBook(null); setModal("bookForm"); });
                }}
              >
                我要賣書
              </button>
              <button
                className={view === "dashboard" ? "active" : ""}
                onClick={() => {
                  setMobileMenuOpen(false);
                  requireLogin(openDashboard);
                }}
              >
                我的交易
              </button>
              {isModerator && (
                <button
                  className={view === "admin" ? "active" : ""}
                  onClick={() => { setView("admin"); setMobileMenuOpen(false); }}
                >
                  審核後台
                </button>
              )}
              <div className="mobile-nav-separator" />
              {currentUser ? (
                <>
                  <button onClick={() => { openDashboard(); setMobileMenuOpen(false); }}>
                    <UserRound size={18} />會員中心
                  </button>
                  <button onClick={() => void logout()}>
                    <LogOut size={18} />登出
                  </button>
                </>
              ) : (
                <button onClick={() => { setModal("login"); setMobileMenuOpen(false); }}>
                  <UserRound size={18} />登入 / 註冊
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {currentUser && showPushPrompt && (
        <section className="push-permission-card">
          <div>
            <Bell size={20} />
            <span>
              <b>不在線也能收到重要通知</b>
              <small>新聊聊、下訂、買家選定、取消、面交、售出與課本確認會透過瀏覽器通知你。</small>
            </span>
          </div>
          <div>
            <button className="ghost" type="button" onClick={dismissPushPrompt}>稍後再說</button>
            <button className="primary" type="button" disabled={pushSaving} onClick={() => void enablePushNotifications()}>開啟推播</button>
          </div>
        </section>
      )}

      {view === "home" && (
        <div className="home-page">
          {currentUser?.accountStatus === "suspended" && (
            <div className="suspension-banner" role="status">
              <Ban size={18} aria-hidden="true" />
              <div><b>帳號目前為唯讀模式</b><span>{currentUser.suspensionReason || "請聯絡管理員了解停權原因。"}</span></div>
            </div>
          )}
          <section className="hero" aria-labelledby="home-hero-title">
            <div className="hero-glow one" aria-hidden="true" />
            <div className="hero-glow two" aria-hidden="true" />
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> 學長姐的書，學弟妹的下一站</span>
              <h1 id="home-hero-title">讓知識繼續流動，<br /><em>一本書也不浪費。</em></h1>
              <p>在校園裡找到你需要的課本，省下一筆，也讓學長姐的筆記繼續發揮價值。</p>
              <div className="hero-search" role="search" aria-label="搜尋課本">
                <label className="visually-hidden" htmlFor="hero-search-input">搜尋書名、課程或老師</label>
                <Search size={21} aria-hidden="true" />
                <input
                  id="hero-search-input"
                  value={heroQuery}
                  onChange={(event) => setHeroQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitHeroSearch();
                  }}
                  placeholder="搜尋書名、課程或老師..."
                />
                <button type="button" onClick={submitHeroSearch}>開始找書</button>
              </div>
              <div className="hero-trust" aria-label="平台特色">
                <span><ShieldCheck size={16} aria-hidden="true" /> 校園面交更安心</span>
                <span><MessageCircle size={16} aria-hidden="true" /> 接受後依賣家設定分享聯絡方式</span>
                <span><GraduationCap size={16} aria-hidden="true" /> 依課程快速找到課本</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="book-stack">
                <div className="floating-note note-one">資料結構<br /><b>省下 $380</b></div>
                <div className="book book-a"><span>DATA<br />STRUCTURES</span></div>
                <div className="book book-b"><span>MANAGEMENT</span></div>
                <div className="book book-c"><span>ENGLISH<br />GRAMMAR</span></div>
                <div className="floating-note note-two"><Check size={16} /> 校內面交</div>
              </div>
            </div>
          </section>

          <section className="market" id="market" aria-labelledby="home-market-title">
            <div className="section-heading">
              <div><span className="section-kicker">LATEST LISTINGS</span><h2 id="home-market-title">最近上架的課本</h2></div>
              <button
                type="button"
                className="sell-cta"
                disabled={currentUser?.accountStatus === "suspended"}
                aria-disabled={currentUser?.accountStatus === "suspended"}
                onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}
              >
                <Plus size={18} aria-hidden="true" />刊登一本書
              </button>
            </div>
            <form className="filters" aria-label="篩選課本" onSubmit={(event) => event.preventDefault()}>
              <label className="filter-search" htmlFor="home-filter-query">
                <span className="visually-hidden">搜尋課本</span>
                <Search size={18} aria-hidden="true" />
                <input
                  id="home-filter-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜尋課本..."
                  aria-label="搜尋課本"
                />
              </label>
              <label htmlFor="home-filter-department">
                <span className="visually-hidden">科系</span>
                <GraduationCap size={18} aria-hidden="true" />
                <select
                  id="home-filter-department"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  aria-label="科系"
                >
                  {departments.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
              <label htmlFor="home-filter-price">
                <span className="visually-hidden">最高價格</span>
                <span className="dollar" aria-hidden="true">$</span>
                <select
                  id="home-filter-price"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  aria-label="最高價格"
                >
                  <option value="">不限價格</option>
                  <option value="300">$300 以下</option>
                  <option value="500">$500 以下</option>
                  <option value="800">$800 以下</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
              <button type="button" className="filter-icon" aria-label="進階篩選（即將推出）" disabled aria-disabled="true">
                <SlidersHorizontal size={18} aria-hidden="true" />
              </button>
            </form>
            <p className="result-line" aria-live="polite" aria-atomic="true">
              <b>{supabase ? marketplaceCount : filteredBooks.length}</b> 本左右的課本正在等待新主人
            </p>
            <div className="book-grid" role="list" aria-label="課本列表">
              {filteredBooks.map((book) => (
                <article className="book-card" key={book.id} role="listitem">
                  <button
                    type="button"
                    className="book-card-main"
                    onClick={() => openBook(book.id)}
                    aria-label={`查看《${book.title}》，${book.author}，${money(book.price)}，${book.condition}`}
                  >
                    <div className="card-image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={book.imageUrl} alt="" loading="lazy" decoding="async" />
                      <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                    </div>
                    <div className="card-body">
                      {book.course && <span className="course-tag">{book.course}</span>}
                      <h3>{book.title}</h3>
                      <p>{book.author} · {book.edition}</p>
                      <div className="card-meta"><span>{book.condition}</span><span><MapPin size={13} aria-hidden="true" />{book.meetup}</span></div>
                      <div className="card-footer"><strong>{money(book.price)}</strong><small>{timeAgo(book.createdAt)}刊登</small></div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`heart ${favoriteIds.has(book.id) ? "active" : ""}`}
                    aria-label={favoriteIds.has(book.id) ? `取消收藏《${book.title}》` : `收藏《${book.title}》`}
                    aria-pressed={favoriteIds.has(book.id)}
                    onClick={(event) => toggleFavorite(book.id, event)}
                  >
                    <Heart size={18} fill={favoriteIds.has(book.id) ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
            {supabase && marketplaceHasMore && (
              <div className="load-more-wrap">
                <button
                  type="button"
                  className="primary"
                  disabled={marketplaceLoading}
                  aria-busy={marketplaceLoading}
                  onClick={() => void loadMarketplaceBooks({ append: true })}
                >
                  {marketplaceLoading ? "載入中..." : "載入更多"}
                </button>
              </div>
            )}
            {filteredBooks.length === 0 && !marketplaceLoading && (
              <div className="empty" role="status" aria-live="polite">
                <BookOpen size={40} aria-hidden="true" />
                <h3>還沒有符合的課本</h3>
                <p>換個關鍵字或篩選條件看看。</p>
              </div>
            )}
            {marketplaceLoading && filteredBooks.length === 0 && (
              <div className="empty" role="status" aria-live="polite" aria-busy="true">
                <BookOpen size={40} aria-hidden="true" />
                <h3>載入中...</h3>
              </div>
            )}
          </section>
        </div>
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
              {(selectedBook.department || selectedBook.course) && (
                <span className="course-tag">{[selectedBook.department, selectedBook.course].filter(Boolean).join(" · ")}</span>
              )}
              <h1>{selectedBook.title}</h1>
              <p className="detail-author">{selectedBook.author} · {selectedBook.edition}</p>
              <strong className="detail-price">{money(selectedBook.price)}</strong>
              <div className="detail-facts">
                <div><small>書況</small><b>{selectedBook.condition}</b></div>
                {selectedBook.teacher && <div><small>授課老師</small><b>{selectedBook.teacher}</b></div>}
                <div><small>面交地點</small><b>{selectedBook.meetup}</b></div>
              </div>
              <div className="description"><h3>賣家說明</h3><p>{selectedBook.description}</p></div>
              <div className="seller-row">
                <span className="avatar">{profile(selectedBook.sellerId)?.name.slice(0, 1) || "賣"}</span>
                <div><small>賣家</small><b>{profile(selectedBook.sellerId)?.name || "賣家"}</b><span>{profile(selectedBook.sellerId)?.department || ""}</span></div>
              </div>
              <div className="detail-action-row">
                {currentUser?.id === selectedBook.sellerId ? (
                  <button className="primary wide" disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(selectedBook); setModal("bookForm"); }}><Pencil size={18} />編輯我的刊登</button>
                ) : (
                  <div className="detail-primary-actions">
                    <button
                      className="chat-toggle wide"
                      disabled={selectedBook.status === "sold" || currentUser?.accountStatus === "suspended"}
                      onClick={() => requireActive(() => void startConversation(selectedBook.id))}
                    >
                      <MessageCircle size={18} />聊聊
                    </button>
                    <button
                      className="primary wide"
                      disabled={selectedBook.status !== "available" || currentUser?.accountStatus === "suspended"}
                      onClick={() => requireActive(() => setModal("request"))}
                    >
                      <Check size={18} />{selectedBook.status === "available" ? "確認下訂" : "已保留，暫停新訂單"}
                    </button>
                  </div>
                )}
                {currentUser?.id !== selectedBook.sellerId && (
                  <div className="detail-more-wrap">
                    <button
                      className="detail-more-button"
                      type="button"
                      aria-label="更多操作"
                      title="更多操作"
                      aria-expanded={detailMenuOpen}
                      onClick={() => setDetailMenuOpen((open) => !open)}
                    >
                      <Ellipsis size={18} />
                    </button>
                    {detailMenuOpen && (
                      <div className="detail-more-menu">
                        <button type="button" onClick={() => { setDetailMenuOpen(false); openReport("book", selectedBook.id, `《${selectedBook.title}》`); }}>檢舉這筆刊登</button>
                        <button type="button" onClick={() => { setDetailMenuOpen(false); openReport("user", selectedBook.sellerId, profile(selectedBook.sellerId)?.name || "賣家"); }}>檢舉賣家</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="safety-note"><ShieldCheck size={15} />只有被選定的買家，才會依賣家設定看到 Email 或 LINE ID。</p>
            </div>
          </div>
        </section>
      )}

      {view === "dashboard" && currentUser && (
        <section className="dashboard">
          <div className="dashboard-head">
            <div><span className="section-kicker">MY HUST BOOKFLOW</span><h1>嗨，{currentUser.name}</h1><p>管理你的刊登與購買意願。</p></div>
            <div className="dashboard-head-actions">
              <button className="secondary-action" disabled={currentUser.accountStatus === "suspended"} onClick={() => requireActive(() => setModal("profile"))}><UserRound size={18} />個人資料</button>
              <button className="primary" disabled={currentUser.accountStatus === "suspended"} onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}><Plus size={18} />刊登課本</button>
            </div>
          </div>
          {currentUser.accountStatus === "suspended" && (
            <div className="readonly-notice"><Ban size={18} /><div><b>唯讀模式</b><span>{currentUser.suspensionReason || "你可以查看既有交易，但暫時不能新增或修改資料。"}</span></div></div>
          )}
          {activeAvailableListings.length > 0 && confirmationDue && (
            <div className="listing-confirmation-panel">
              <div>
                <b>定期確認課本仍在販售</b>
                <span>
                  {nextConfirmationAt
                    ? `目前 ${activeAvailableListings.length} 本公開販售中，下次確認日為 ${dateLabel(nextConfirmationAt)}。`
                    : `目前 ${activeAvailableListings.length} 本公開販售中。`}
                  每 30 天確認一次；最後確認後滿 120 天仍未處理，才會暫時封存。
                </span>
              </div>
              <button className="primary" disabled={lifecycleSaving} onClick={() => void confirmAllListings()}>
                <CheckCheck size={17} />全部仍在販售
              </button>
            </div>
          )}
          {archivedListings.length > 0 && (
            <div className="archived-review-panel">
              <div>
                <b>有 {archivedListings.length} 本課本因逾期暫時封存</b>
                <span>勾選後選擇恢復販售或正式下架；系統不會自動讓舊書重新公開。</span>
              </div>
              <div className="archived-review-actions">
                <button
                  disabled={selectedArchivedIds.size === 0 || lifecycleSaving}
                  onClick={() => void reviewArchivedListings("keep")}
                >
                  <RotateCcw size={16} />恢復勾選項目
                </button>
                <button
                  className="danger"
                  disabled={selectedArchivedIds.size === 0 || lifecycleSaving}
                  onClick={() => void reviewArchivedListings("withdraw")}
                >
                  <Trash2 size={16} />勾選項目已下架
                </button>
              </div>
            </div>
          )}
          <div className="dashboard-tabs">
            <button className={dashboardTab === "listings" ? "active" : ""} onClick={() => setDashboardTab("listings")}>我的刊登 <span>{myListings.length}</span></button>
            <button className={dashboardTab === "chats" ? "active" : ""} onClick={() => setDashboardTab("chats")}>
              聊聊 <span>{conversations.reduce((sum, item) => sum + item.unreadCount, 0)}</span>
            </button>
            <button className={dashboardTab === "requests" ? "active" : ""} onClick={() => setDashboardTab("requests")}>我送出的意願 <span>{myRequests.length}</span></button>
            <button className={dashboardTab === "received" ? "active" : ""} onClick={() => setDashboardTab("received")}>收到的意願 <span>{receivedRequests.length}</span></button>
            <button className={dashboardTab === "favorites" ? "active" : ""} onClick={() => setDashboardTab("favorites")}>我的收藏 <span>{favoriteBooks.length}</span></button>
          </div>

          {dashboardTab === "listings" && (
            <div className="dashboard-list">
              {myListings.map((book) => (
                <div className={`listing-row lifecycle-${book.lifecycleState}`} key={book.id}>
                  {book.lifecycleState === "archived" && (
                    <label className="listing-select">
                      <input
                        type="checkbox"
                        checked={selectedArchivedIds.has(book.id)}
                        onChange={(event) => {
                          setSelectedArchivedIds((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) next.add(book.id);
                            else next.delete(book.id);
                            return next;
                          });
                        }}
                      />
                      <span>選取</span>
                    </label>
                  )}
                  {book.imageUrl
                    ? <img src={book.imageUrl} alt="" />
                    : <div className="listing-image-placeholder"><BookOpen size={24} /></div>}
                  <div className="listing-main">
                    <div className="listing-badges">
                      <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                      {book.lifecycleState !== "active" && (
                        <span className={`lifecycle-badge ${book.lifecycleState}`}>
                          {book.lifecycleState === "archived" ? "暫時封存" : "已下架"}
                        </span>
                      )}
                    </div>
                    <h3>{book.title}</h3>
                    <p>{book.course ? `${book.course} · ` : ""}{money(book.price)}</p>
                    {book.lifecycleState === "archived" && (
                      <small className="archive-note">
                        {book.archivedAt ? `${dateLabel(book.archivedAt)}封存 · ` : ""}
                        回來確認後才會再次公開
                      </small>
                    )}
                  </div>
                  <div className="row-actions">
                    {book.lifecycleState === "active" && (
                      <>
                        <button disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(book); setModal("bookForm"); }}><Pencil size={16} />編輯</button>
                        <button disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(book); setModal("contactSettings"); }}><MessageCircle size={16} />聯絡方式</button>
                        <button disabled={currentUser.accountStatus === "suspended"} className="danger" onClick={() => deleteBook(book.id)}><Trash2 size={16} />下架</button>
                      </>
                    )}
                    {book.lifecycleState === "withdrawn" && (
                      <button disabled={lifecycleSaving || currentUser.accountStatus === "suspended"} onClick={() => void restoreWithdrawnListing(book.id)}>
                        <RotateCcw size={16} />恢復販售
                      </button>
                    )}
                  </div>
                  <div className={`review-badge ${book.reviewStatus}`}>{reviewLabels[book.reviewStatus]}</div>
                  {book.reviewStatus === "rejected" && book.reviewNote && <p className="review-note">拒絕原因：{book.reviewNote}</p>}
                </div>
              ))}
              {myListings.length === 0 && <EmptyDashboard text="你還沒有刊登任何課本" />}
            </div>
          )}

          {dashboardTab === "chats" && (
            <div className="conversation-layout">
              <div className="conversation-list">
                {conversations.map((conversation) => {
                  const book = knownBooks.find((item) => item.id === conversation.bookId);
                  const otherId = conversation.buyerId === currentUser.id
                    ? conversation.sellerId
                    : conversation.buyerId;
                  return (
                    <button
                      type="button"
                      className={`conversation-item ${expandedConversationId === conversation.id ? "active" : ""}`}
                      key={conversation.id}
                      onClick={() => void openConversation(conversation.id)}
                    >
                      <span className="avatar">{profile(otherId)?.name.slice(0, 1) || "聊"}</span>
                      <span>
                        <b>{profile(otherId)?.name || "交易對象"}</b>
                        <small>{book?.title || "已移除的課本"} · {conversation.status === "active" ? "可聊天" : "已結束"}</small>
                      </span>
                      {conversation.unreadCount > 0 && <em>{conversation.unreadCount}</em>}
                    </button>
                  );
                })}
                {conversations.length === 0 && <EmptyDashboard text="目前沒有聊聊紀錄" />}
              </div>
              <div className="conversation-panel">
                {expandedConversationId && conversations.some((item) => item.id === expandedConversationId) ? (
                  <TradeChatPanel
                    key={expandedConversationId}
                    conversation={conversations.find((item) => item.id === expandedConversationId)!}
                    currentUserId={currentUser.id}
                    profiles={store.profiles}
                    onChanged={reloadAfterUserMutation}
                    onRead={keepConversationRead}
                  />
                ) : (
                  <EmptyDashboard text="選擇一個聊天室開始聯絡" />
                )}
              </div>
            </div>
          )}

          {dashboardTab === "requests" && (
            <div className="dashboard-list">
              {myRequests.map((request) => {
                const book = (supabase ? [...myBooks, ...requestBooks, ...marketplaceBooks] : store.books)
                  .find((item) => item.id === request.bookId);
                const contact = contacts[request.id];
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <div className="request-icon"><MessageCircle /></div>
                    <div className="request-main">
                      <span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span>
                      <h3>{book.title}</h3>
                      {request.message && !HIDDEN_REQUEST_MESSAGES.has(request.message) && <p>「{request.message}」</p>}
                      {["reserved", "awaiting_confirmation", "completed"].includes(request.status) && contact && (
                        <div className="contact-box">
                          <Check size={16} />
                          賣家{contact.method === "line" ? " LINE ID" : " Email"}：<b>{contact.value}</b>
                        </div>
                      )}
                      {["reserved", "awaiting_confirmation", "completed"].includes(request.status) && !contact && <div className="contact-note">賣家尚未分享額外聯絡方式，請使用聊聊聯絡。</div>}
                      <OrderTimeline request={request} />
                    </div>
                    <div className="request-actions">
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button onClick={() => void cancelRequest(request.id)}><X size={16} />取消訂單</button>
                      )}
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button onClick={() => {
                          setEditingRequest(request);
                          setSelectedId(request.bookId);
                          setDetailBook(null);
                          setModal("request");
                        }}><Pencil size={16} />編輯</button>
                      )}
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button onClick={() => void openOrderConversation(request.id)}><MessageCircle size={16} />聊聊</button>
                      )}
                      {request.status === "awaiting_confirmation" && (
                        <button className="accept" onClick={() => void buyerConfirmTrade(request.id)}><CheckCheck size={16} />確認收到</button>
                      )}
                    </div>
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
                const book = (supabase ? [...myBooks, ...requestBooks, ...marketplaceBooks] : store.books)
                  .find((item) => item.id === request.bookId);
                const buyer = profile(request.buyerId);
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <span className="avatar">{buyer?.name.slice(0, 1)}</span>
                    <div className="request-main">
                      <span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span>
                      <h3>{buyer?.name} 想買《{book.title}》</h3>
                      {request.message && !HIDDEN_REQUEST_MESSAGES.has(request.message) && <p>「{request.message}」</p>}
                      {["reserved", "awaiting_confirmation"].includes(request.status) && <div className="contact-note">聯絡請使用獨立的「聊聊」頁籤。</div>}
                      <OrderTimeline request={request} />
                    </div>
                    <div className="request-actions">
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button onClick={() => void openOrderConversation(request.id)}><MessageCircle size={16} />聊聊</button>
                      )}
                      {["pending", "waitlisted"].includes(request.status) && book.status === "available" && (
                        <button className="accept" onClick={() => void respondToRequest(request.id, "accepted")}><Check size={16} />選定買家</button>
                      )}
                      {["pending", "waitlisted"].includes(request.status) && (
                        <button onClick={() => void respondToRequest(request.id, "rejected")}><X size={16} />婉拒</button>
                      )}
                      {request.status === "reserved" && (
                        <>
                          <button className="accept" onClick={() => void sellerConfirmHandoff(request.id)}><CheckCheck size={16} />已完成面交</button>
                          <button onClick={() => void cancelRequest(request.id)}><X size={16} />取消保留</button>
                        </>
                      )}
                    </div>
                    {buyer && request.status === "pending" && (
                      <button
                        className="request-report-button"
                        title="檢舉這位買家"
                        aria-label="檢舉這位買家"
                        onClick={() => openReport("user", buyer.id, buyer.name)}
                      >
                        <Flag size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {receivedRequests.length === 0 && <EmptyDashboard text="目前還沒有人送出購買意願" />}
            </div>
          )}

          {dashboardTab === "favorites" && (
            <div className="book-grid favorites-grid">
              {favoriteBooks.map((book) => (
                <article className="book-card" key={book.id} onClick={() => openBook(book.id)}>
                  <div className="card-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={book.imageUrl} alt={book.title} loading="lazy" decoding="async" />
                    <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                    <button
                      className="heart active"
                      aria-label="取消收藏"
                      aria-pressed="true"
                      onClick={(event) => toggleFavorite(book.id, event)}
                    >
                      <Heart size={18} fill="currentColor" />
                    </button>
                  </div>
                  <div className="card-body">
                    {book.course && <span className="course-tag">{book.course}</span>}
                    <h3>{book.title}</h3>
                    <p>{book.author} · {book.edition}</p>
                    <div className="card-footer"><strong>{money(book.price)}</strong><small>{book.condition}</small></div>
                  </div>
                </article>
              ))}
              {favoriteBooks.length === 0 && <EmptyDashboard text="你還沒有收藏任何課本" />}
            </div>
          )}
        </section>
      )}

      {view === "admin" && currentUser && isModerator && (
        <section className="dashboard admin-page">
          <div className="dashboard-head">
            <div>
              <span className="section-kicker">MODERATION</span>
              <h1>安全與審核後台</h1>
              <p>處理檢舉、刊登審核、商品隱藏與會員權限。</p>
            </div>
            <div className="admin-count">{pendingReports.length + pendingReviews.length} 筆待處理</div>
          </div>

          <h2 className="admin-section-title">待處理檢舉</h2>
          <div className="reports-list">
            {pendingReports.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-card-head">
                  <span className={`report-target ${report.targetType}`}><Flag size={14} />{report.targetType === "book" ? "商品檢舉" : "使用者檢舉"}</span>
                  <time>{timeAgo(report.createdAt)}</time>
                </div>
                <h3>{report.targetName}</h3>
                <p><b>{reportReasonLabels[report.reason]}</b>{report.details ? `：${report.details}` : ""}</p>
                <small>檢舉人：{report.reporterName}</small>
                <div className="report-actions">
                  <button onClick={() => void resolveReport(report.id, "dismiss")}><X size={16} />駁回</button>
                  <button onClick={() => void resolveReport(report.id, "resolve")}><Check size={16} />僅記錄並結案</button>
                  {report.targetType === "book" && <button className="warn" onClick={() => void resolveReport(report.id, "hide_book")}><EyeOff size={16} />隱藏商品</button>}
                  {currentUser.role === "admin" && <button className="danger" onClick={() => void resolveReport(report.id, "suspend_user")}><Ban size={16} />停權會員</button>}
                </div>
              </article>
            ))}
          </div>
          {pendingReports.length === 0 && <EmptyDashboard text="目前沒有等待處理的檢舉" />}

          <h2 className="admin-section-title">待審核刊登</h2>
          <div className="moderation-grid">
            {pendingReviews.map((book) => {
              const seller = profile(book.sellerId);
              return (
                <article className="moderation-card" key={book.id}>
                  <div className="moderation-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={book.imageUrl} alt={book.title} />
                    <span className="review-badge pending">待審核</span>
                  </div>
                  <div className="moderation-body">
                    <h3>{book.title}</h3>
                    <p>{book.author} · {book.edition}</p>
                    <dl>
                      <div><dt>賣家</dt><dd>{seller?.name || "使用者"}<br /><small>{seller?.email}</small></dd></div>
                      <div><dt>書況</dt><dd>{book.condition}</dd></div>
                      <div><dt>價格</dt><dd>{money(book.price)}</dd></div>
                      <div><dt>面交</dt><dd>{book.meetup}</dd></div>
                    </dl>
                    <div className="moderation-description">{book.description}</div>
                    <div className="moderation-actions">
                      <button className="accept" onClick={() => void reviewBook(book.id, "approved")}><Check size={17} />通過上架</button>
                      <button className="reject" onClick={() => void reviewBook(book.id, "rejected")}><X size={17} />拒絕</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {pendingReviews.length === 0 && <EmptyDashboard text="目前沒有等待審核的書籍" />}

          {hiddenBooks.length > 0 && (
            <>
              <h2 className="admin-section-title permissions-title">已隱藏商品</h2>
              <div className="permissions-list">
                {hiddenBooks.map((book) => (
                  <div className="permission-row" key={book.id}>
                    <span className="avatar"><EyeOff size={17} /></span>
                    <div><b>{book.title}</b><small>賣家：{profile(book.sellerId)?.name || "使用者"}</small></div>
                    <button className="restore-button" onClick={() => void restoreBook(book.id)}><RotateCcw size={15} />恢復顯示</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {currentUser.role === "admin" && (
            <>
              <h2 className="admin-section-title permissions-title">管理權限</h2>
              <div className="permissions-list">
                {store.profiles.map((user) => (
                  <div className="permission-row" key={user.id}>
                    <span className="avatar">{user.name.slice(0, 1)}</span>
                    <div>
                      <b>{user.name}{user.accountStatus === "suspended" && <span className="suspended-tag">已停權</span>}</b>
                      <small>{user.email}</small>
                      {user.suspensionReason && <small className="suspension-reason">原因：{user.suspensionReason}</small>}
                    </div>
                    <select value={user.role} disabled={user.id === currentUser.id} onChange={(event) => void changeRole(user.id, event.target.value as UserRole)}>
                      <option value="user">一般使用者</option>
                      <option value="moderator">審核員</option>
                      <option value="admin">管理員</option>
                    </select>
                    {user.id !== currentUser.id && user.role !== "admin" && (
                      user.accountStatus === "suspended"
                        ? <button className="restore-button" onClick={() => void changeAccountStatus(user.id, "active")}><RotateCcw size={15} />解除停權</button>
                        : <button className="suspend-button" onClick={() => void changeAccountStatus(user.id, "suspended")}><Ban size={15} />停權</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <footer><div className="brand footer-brand"><span className="brand-mark"><BookOpen size={20} /></span><span><b>虎科書流</b><small>HUST BOOKFLOW</small></span></div><p>讓每一本課本，都找到下一位需要它的人。</p><span>虎科校園二手書交流平台 · Prototype 2026</span></footer>

      {modal === "login" && (
        <LoginModal
          configured={isSupabaseConfigured}
          onClose={() => setModal(null)}
          onGoogleLogin={loginWithGoogle}
          onLogin={loginWithPassword}
          onSignUp={signUpWithPassword}
          onVerifySignup={verifySignupCode}
          onResendSignup={resendSignupCode}
          onRequestReset={requestPasswordReset}
        />
      )}
      {modal === "adminOtp" && (
        <AdminOtpModal
          email={adminOtpEmail}
          onClose={() => void logout()}
          onVerify={verifyAdminOtp}
          onResend={resendAdminOtp}
        />
      )}
      {modal === "resetPassword" && (
        <ResetPasswordModal
          configured={isSupabaseConfigured}
          onClose={() => setModal(null)}
          onSubmit={updatePassword}
        />
      )}
      {modal === "profile" && currentUser && (
        <ProfileModal
          profile={currentUser}
          onClose={() => setModal(null)}
          onSubmit={saveProfile}
        />
      )}
      {modal === "bookForm" && <BookFormModal book={editingBook} saving={bookSaving} onClose={() => { if (bookSaving) return; setModal(null); setEditingBook(null); }} onSubmit={saveBook} />}
      {modal === "contactSettings" && editingBook && (
        <ContactSettingsModal
          book={editingBook}
          onClose={() => { setModal(null); setEditingBook(null); }}
          onSubmit={saveContactSettings}
        />
      )}
      {modal === "request" && selectedBook && (
        <RequestModal
          book={selectedBook}
          request={editingRequest}
          onClose={() => { setModal(null); setEditingRequest(null); }}
          onSubmit={sendRequest}
        />
      )}
      {modal === "report" && reportTarget && (
        <ReportModal
          target={reportTarget}
          onClose={() => { setModal(null); setReportTarget(null); }}
          onSubmit={submitReport}
        />
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><div className="modal-heading"><span className="brand-mark"><BookOpen size={21} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</div></div>;
}

function AdminOtpModal({
  email,
  onClose,
  onVerify,
  onResend,
}: {
  email: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onVerify(code);
    setLoading(false);
    if (message) setError(message);
  }

  async function resend() {
    setLoading(true);
    setError("");
    const message = await onResend();
    setLoading(false);
    if (message) setError(message);
    else setCode("");
  }

  return (
    <ModalShell title="管理員安全驗證" subtitle="高權限帳號需要完成第二階段驗證" onClose={onClose}>
      <div className="email-login">
        <div className="auth-shield"><ShieldCheck size={24} /></div>
        <h3>輸入 8 位數驗證碼</h3>
        <p>驗證碼已寄到 <b>{maskEmail(email)}</b>，請在有效期限內完成驗證。</p>
        <form className="otp-form" onSubmit={submit}>
          <label>
            管理員驗證碼
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
            {loading ? "驗證中..." : "完成安全驗證"}
          </button>
          <button className="text-button" type="button" disabled={loading} onClick={() => void resend()}>
            重新寄送驗證碼
          </button>
        </form>
        {error && <p className="auth-error">{error}</p>}
        <div className="privacy-note"><ShieldCheck size={15} />關閉此視窗會立即登出，未驗證前無法使用管理權限。</div>
      </div>
    </ModalShell>
  );
}

function ProfileModal({
  profile,
  onClose,
  onSubmit,
}: {
  profile: Profile;
  onClose: () => void;
  onSubmit: (name: string, department: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const message = await onSubmit(name, department);
    if (message) setError(message);
    setSaving(false);
  }

  return (
    <ModalShell title="個人資料" subtitle="更新其他使用者會看到的姓名與系所" onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <label>
          姓名
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
        </label>
        <label>
          系所
          <select value={department} onChange={(event) => setDepartment(event.target.value)} required>
            <option value="">請選擇系所</option>
            {departments.slice(1).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          登入 Email
          <input value={profile.email} disabled />
        </label>
        <p className="form-note">登入 Email 涉及帳號驗證，目前不能在這裡直接修改。</p>
        {error && <p className="form-error">{error}</p>}
        <button className="primary wide" type="submit" disabled={saving}>
          {saving ? "儲存中..." : "儲存個人資料"}
        </button>
      </form>
    </ModalShell>
  );
}

function LoginModal({
  configured,
  onClose,
  onGoogleLogin,
  onLogin,
  onSignUp,
  onVerifySignup,
  onResendSignup,
  onRequestReset,
}: {
  configured: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<string | null>;
  onLogin: (email: string, password: string) => Promise<string | null>;
  onSignUp: (name: string, department: string, email: string, password: string) => Promise<string | null>;
  onVerifySignup: (email: string, token: string) => Promise<string | null>;
  onResendSignup: (email: string) => Promise<string | null>;
  onRequestReset: (email: string) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [signupStep, setSignupStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setSignupStep("form");
    setCode("");
    setError("");
  }

  async function startGoogleLogin() {
    setOauthLoading(true);
    setError("");
    const message = await onGoogleLogin();
    if (message) {
      setError(message);
      setOauthLoading(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onLogin(email.trim(), password);
    setLoading(false);
    if (message) setError(message);
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (name.trim().length > 60) {
      setError("姓名不可超過 60 個字");
      return;
    }
    if (!departments.slice(1).includes(department)) {
      setError("請選擇系所");
      return;
    }
    if (password.length < 8) {
      setError("密碼至少需要 8 個字元");
      return;
    }
    if (password !== passwordConfirm) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    setLoading(true);
    const message = await onSignUp(name.trim(), department, email.trim(), password);
    setLoading(false);
    if (message) setError(message);
    else {
      setSignupStep("code");
      setResendCooldown(60);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onVerifySignup(email.trim(), code.trim());
    setLoading(false);
    if (message) setError(message);
  }

  async function resendCode() {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError("");
    const message = await onResendSignup(email.trim());
    setLoading(false);
    if (message) setError(message);
    else setResendCooldown(60);
  }

  async function submitForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const message = await onRequestReset(email.trim());
    setLoading(false);
    if (message) setError(message);
  }

  return (
    <ModalShell title="虎科書流會員" subtitle="登入既有帳號，或免費註冊新帳號" onClose={onClose}>
      <div className="email-login">
        <div className="auth-shield"><ShieldCheck size={24} /></div>
        {mode !== "forgot" && signupStep === "form" && (
          <>
            <button
              className="google-login-button"
              type="button"
              disabled={loading || oauthLoading || !configured}
              onClick={() => void startGoogleLogin()}
            >
              <GoogleLogo />
              {oauthLoading ? "正在前往 Google..." : "使用 Google 帳號繼續"}
            </button>
            <div className="auth-divider"><span>或使用 Email</span></div>
            <div className="auth-tabs" role="tablist" aria-label="會員驗證方式">
              <button className={mode === "login" ? "active" : ""} type="button" onClick={() => switchMode("login")}>登入</button>
              <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => switchMode("signup")}>註冊</button>
            </div>
          </>
        )}
        {mode === "login" ? (
          <>
            <h3>歡迎回來</h3>
            <p>輸入註冊時使用的 Email 與密碼即可登入。</p>
            <form className="otp-form" onSubmit={submitLogin}>
              <label>
                Email
                <input
                  autoFocus
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="yourname@example.com"
                  required
                />
              </label>
              <label>
                密碼
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="輸入密碼"
                  required
                />
              </label>
              <button className="primary wide" type="submit" disabled={loading || !configured}>
                {loading ? "登入中..." : "登入"}
              </button>
              <button className="text-button" type="button" onClick={() => { setMode("forgot"); setError(""); }}>
                忘記密碼？
              </button>
            </form>
          </>
        ) : mode === "signup" && signupStep === "form" ? (
          <>
            <h3>建立新帳號</h3>
            <p>填寫基本資料後，我們會寄送 8 位數驗證碼確認 Email。</p>
            <form className="otp-form auth-signup-form" onSubmit={submitSignup}>
              <label>
                姓名
                <input
                  autoFocus
                  type="text"
                  autoComplete="name"
                  minLength={1}
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="輸入姓名"
                  required
                />
              </label>
              <label>
                系所
                <select value={department} onChange={(event) => setDepartment(event.target.value)} required>
                  <option value="">請選擇系所</option>
                  {departments.slice(1).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="full">
                Email
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="yourname@example.com"
                  required
                />
              </label>
              <label>
                密碼
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 個字元"
                  required
                />
              </label>
              <label>
                確認密碼
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="再次輸入密碼"
                  required
                />
              </label>
              <button className="primary wide full" type="submit" disabled={loading || !configured}>
                {loading ? "建立帳號中..." : "註冊並寄送驗證碼"}
              </button>
            </form>
          </>
        ) : mode === "signup" ? (
          <>
            <h3>輸入 8 位數驗證碼</h3>
            <p>驗證碼已寄到 <b>{email}</b>。若信件內容只有 8 位數字，請直接輸入該數字完成註冊。</p>
            <p className="auth-hint">若同時收到「註冊驗證碼說明」信件，請以含 8 位數驗證碼的通知信為準。</p>
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
                {loading ? "驗證中..." : "完成註冊"}
              </button>
              <div className="auth-link-row">
                <button className="text-button" type="button" disabled={loading} onClick={() => { setSignupStep("form"); setCode(""); setError(""); }}>
                  返回修改資料
                </button>
                <button className="text-button" type="button" disabled={loading || resendCooldown > 0} onClick={() => void resendCode()}>
                  {resendCooldown > 0 ? `${resendCooldown} 秒後可重新寄送` : "重新寄送驗證碼"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3>重設密碼</h3>
            <p>輸入註冊 Email，我們會寄送密碼重設連結。</p>
            <form className="otp-form" onSubmit={submitForgotPassword}>
              <label>
                Email
                <input
                  autoFocus
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="yourname@example.com"
                  required
                />
              </label>
              <button className="primary wide" type="submit" disabled={loading || !configured}>
                {loading ? "寄送中..." : "寄送密碼重設信"}
              </button>
              <button className="text-button" type="button" onClick={() => { setMode("login"); setError(""); }}>
                返回登入
              </button>
            </form>
          </>
        )}
        {error && <div className="auth-error">{error}</div>}
        {!configured && <div className="auth-warning">網站管理員尚未完成 Email 驗證設定，請先依照專案內的設定指南操作。</div>}
        <small><ShieldCheck size={13} />密碼由 Supabase Auth 加密處理，網站不會讀取你的明碼密碼。</small>
      </div>
    </ModalShell>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14.1a6 6 0 0 1 0-4.2V7.3H3.2a10 10 0 0 0 0 9.4l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z" />
    </svg>
  );
}

function ResetPasswordModal({
  configured,
  onClose,
  onSubmit,
}: {
  configured: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("密碼至少需要 8 個字元");
      return;
    }
    if (password !== passwordConfirm) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    setLoading(true);
    const message = await onSubmit(password);
    setLoading(false);
    if (message) setError(message);
  }

  return (
    <ModalShell title="設定新密碼" subtitle="完成後即可使用新密碼登入" onClose={onClose}>
      <div className="email-login">
        <div className="auth-shield"><ShieldCheck size={24} /></div>
        <h3>建立新的登入密碼</h3>
        <p>新密碼至少需要 8 個字元，並請再次輸入確認。</p>
        <form className="otp-form" onSubmit={savePassword}>
          <label>
            新密碼
            <input
              autoFocus
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label>
            確認新密碼
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
            />
          </label>
          <button className="primary wide" type="submit" disabled={loading || !configured}>
            {loading ? "更新中..." : "更新密碼"}
          </button>
        </form>
        {error && <div className="auth-error">{error}</div>}
      </div>
    </ModalShell>
  );
}

function BookFormModal({ book, saving, onClose, onSubmit }: { book: Book | null; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const value = book ?? blankBook;
  const [preview, setPreview] = useState(value.imageUrl);

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return <ModalShell title={book ? "編輯刊登" : "刊登一本課本"} subtitle="標示 * 的欄位為必填" onClose={onClose}><form onSubmit={onSubmit} className="form book-form"><fieldset disabled={saving} className="book-form-fields"><label className="full">書名 *<input name="title" required defaultValue={value.title} placeholder="例如：資料結構：使用 C++" /></label><label>作者 *<input name="author" required defaultValue={value.author} /></label><label>版本 *<input name="edition" required defaultValue={value.edition} placeholder="例如：第 2 版" /></label><label>科系（選填）<select name="department" defaultValue={value.department}><option value="">不指定科系</option>{departments.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>課程（選填）<input name="course" defaultValue={value.course} /></label><label>授課老師（選填）<input name="teacher" defaultValue={value.teacher} /></label><label>書況 *<select name="condition" required defaultValue={value.condition}><option>近全新</option><option>書況良好</option><option>有筆記</option><option>使用痕跡明顯</option><option>損壞嚴重</option></select></label><label>價格（NT$）*<input name="price" required type="number" min="0" defaultValue={value.price || ""} /></label><label className="full">面交地點 *<input name="meetup" required defaultValue={value.meetup} placeholder="例如：圖書館一樓" /></label><label className="full">封面圖片 *<span className="image-upload"><input name="image" required={!book} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><ImagePlus size={22} /><b>{book ? "選擇新圖片（不選則保留原圖）" : "選擇圖片檔"}</b><small>支援 JPG、PNG、WebP，最大 5MB</small></span></label>{preview && <div className="image-preview full"><img src={preview} alt="書籍封面預覽" /></div>}<label className="full">書況說明 *<textarea name="description" required rows={3} defaultValue={value.description} /></label><button className="primary wide full" type="submit" disabled={saving}>{saving ? (book ? "儲存中..." : "刊登中...") : book ? "儲存變更" : "確認刊登"}</button></fieldset></form></ModalShell>;
}

function ContactSettingsModal({
  book,
  onClose,
  onSubmit,
}: {
  book: Book;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<Book["contactMethod"]>(book.contactMethod);

  return (
    <ModalShell title="額外聯絡方式" subtitle={`設定「${book.title}」成交後要提供給買家的資料`} onClose={onClose}>
      <form className="form" onSubmit={onSubmit}>
        <label>
          分享方式
          <select
            name="contactMethod"
            value={method}
            onChange={(event) => setMethod(event.target.value as Book["contactMethod"])}
          >
            <option value="none">不分享，僅使用站內聊天室</option>
            <option value="email">分享帳號 Email</option>
            <option value="line">分享 LINE ID</option>
          </select>
        </label>
        {method === "line" && (
          <label>
            LINE ID
            <input
              name="contactValue"
              defaultValue={book.contactMethod === "line" ? book.contactValue : ""}
              placeholder="請輸入你的 LINE ID"
              maxLength={100}
              required
            />
          </label>
        )}
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>只有你接受購買要求後，買家才會看到這項資料。買家的 Email 不會自動顯示給你。</span>
        </div>
        <button className="primary wide" type="submit">儲存聯絡方式設定</button>
      </form>
    </ModalShell>
  );
}

function RequestModal({
  book,
  request,
  onClose,
  onSubmit,
}: {
  book: Book;
  request?: PurchaseRequest | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [message, setMessage] = useState(request?.message || REQUEST_PHRASES[0]);

  return (
    <ModalShell title="確認下訂" subtitle={`想購買《${book.title}》`} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <div className="request-summary"><span>{book.condition}</span><b>{money(book.price)}</b><span><MapPin size={14} />{book.meetup}</span></div>
        <div className="phrase-list">
          <small>快速選擇常用語</small>
          <div className="phrase-chips">
            {REQUEST_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className={`phrase-chip ${message === phrase ? "active" : ""}`}
                onClick={() => setMessage(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
        <label>
          給賣家的留言
          <textarea
            name="message"
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="介紹一下方便面交的時間，或想確認的書況..."
          />
        </label>
        <button className="primary wide" type="submit">
          {request ? <Pencil size={17} /> : <MessageCircle size={17} />}
          {request ? "儲存訂單修改" : "確認下訂"}
        </button>
        <p className="form-note">下訂後仍需等待賣家選定，不代表交易完成。</p>
      </form>
    </ModalShell>
  );
}

function ReportModal({
  target,
  onClose,
  onSubmit,
}: {
  target: { type: ReportTargetType; id: string; label: string };
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <ModalShell
      title={target.type === "book" ? "檢舉刊登" : "檢舉使用者"}
      subtitle={`檢舉對象：${target.label}`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form">
        <label>
          檢舉原因 *
          <select name="reason" required defaultValue="">
            <option value="" disabled>請選擇原因</option>
            {Object.entries(reportReasonLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          補充說明
          <textarea name="details" rows={5} maxLength={1000} placeholder="請提供管理員判斷所需的具體情況。" />
        </label>
        <button className="primary wide" type="submit"><Flag size={16} />送出檢舉</button>
        <p className="form-note">檢舉不會自動下架或停權，會由管理員人工審核。</p>
      </form>
    </ModalShell>
  );
}

function OrderTimeline({ request }: { request: PurchaseRequest }) {
  const steps = [
    { label: "已提出請求", done: true },
    { label: "賣家已選定", done: ["reserved", "awaiting_confirmation", "completed"].includes(request.status) },
    { label: "等待面交", done: ["awaiting_confirmation", "completed"].includes(request.status) },
    { label: request.status === "cancelled" ? "已取消" : "已完成", done: ["completed", "cancelled", "expired"].includes(request.status) },
  ];
  return <div className="order-timeline">{steps.map((step) => <span className={step.done ? "done" : ""} key={step.label}>{step.label}</span>)}</div>;
}

/* eslint-disable @next/next/no-img-element */
function TradeChatPanel({
  conversation,
  currentUserId,
  profiles,
  onChanged,
  onRead,
}: {
  conversation: Conversation;
  currentUserId: string;
  profiles: Profile[];
  onChanged: () => void;
  onRead: (conversationId: string) => void;
}) {
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [messageCursor, setMessageCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const otherUserId = conversation.buyerId === currentUserId ? conversation.sellerId : conversation.buyerId;

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    setError("");
    setLoading(true);
    setMessages([]);
    setImageUrls({});
    setHasOlderMessages(false);
    setMessageCursor(null);
    void fetchTradeMessages(client, conversation.id)
      .then(async (page) => {
        if (!active) return;
        setMessages(page.messages);
        setHasOlderMessages(page.hasMore);
        setMessageCursor(page.nextCursor);
        onRead(conversation.id);
        try {
          await markConversationRead(client, conversation.id);
        } catch (readError) {
          if (active) {
            setError(readError instanceof Error ? readError.message : "無法更新已讀狀態");
          }
        }
        if (!active) return;
        const paths = [...new Set(page.messages.flatMap((item) => item.imagePaths))];
        if (paths.length === 0) return;
        try {
          const signed = await signChatImages(client, paths);
          if (active) setImageUrls(signed);
        } catch (signError) {
          if (active) {
            setError(signError instanceof Error ? signError.message : "部分圖片無法載入");
          }
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setMessages([]);
        setError(loadError instanceof Error ? loadError.message : "無法載入聊聊");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = client
      .channel(`trade-chat:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (!active) return;
          let message: TradeMessage;
          try {
            message = mapTradeMessage(payload.new as Record<string, unknown>);
          } catch {
            return;
          }
          setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
          onRead(conversation.id);
          void markConversationRead(client, conversation.id).catch(() => undefined);
          if (message.imagePaths.length === 0) return;
          void signChatImages(client, message.imagePaths)
            .then((signed) => {
              if (active) setImageUrls((previous) => ({ ...previous, ...signed }));
            })
            .catch((signError) => {
              if (active) {
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
  }, [conversation.id, onRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!enlargedImageUrl) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlargedImageUrl(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [enlargedImageUrl]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || (!draft.trim() && files.length === 0)) return;
    const body = draft.trim();
    setDraft("");
    setError("");
    setSending(true);
    let uploadedPaths: string[] = [];
    try {
      uploadedPaths = files.length > 0
        ? await uploadChatImages(supabase, conversation.id, currentUserId, files)
        : [];
      const message = await sendTradeMessage(supabase, conversation.id, body, uploadedPaths);
      setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
      if (uploadedPaths.length > 0) {
        const signed = await signChatImages(supabase, uploadedPaths);
        setImageUrls((previous) => ({ ...previous, ...signed }));
      }
      setFiles([]);
      void dispatchBrowserPush(supabase);
    } catch (sendError) {
      if (uploadedPaths.length > 0) {
        await deleteChatImageUploads(supabase, uploadedPaths).catch(() => undefined);
      }
      setDraft(body);
      setError(sendError instanceof Error ? sendError.message : "訊息傳送失敗");
    } finally {
      setSending(false);
    }
  }

  const senderName = (senderId: string) => profiles.find((profile) => profile.id === senderId)?.name || "使用者";

  async function loadOlderMessages() {
    if (!supabase || !messageCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchTradeMessages(supabase, conversation.id, messageCursor);
      setMessages((previous) => [
        ...page.messages.filter((item) => !previous.some((existing) => existing.id === item.id)),
        ...previous,
      ]);
      setHasOlderMessages(page.hasMore);
      setMessageCursor(page.nextCursor);
      const paths = [...new Set(page.messages.flatMap((item) => item.imagePaths))];
      const signed = await signChatImages(supabase, paths);
      setImageUrls((previous) => ({ ...previous, ...signed }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "無法載入較早訊息");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function recall(messageId: string) {
    if (!supabase) return;
    try {
      await recallTradeMessage(supabase, messageId);
      setMessages((previous) => previous.map((message) =>
        message.id === messageId ? { ...message, body: "", recalledAt: new Date().toISOString() } : message,
      ));
    } catch (recallError) {
      setError(recallError instanceof Error ? recallError.message : "無法收回訊息");
    }
  }

  async function closeChat() {
    if (!supabase) return;
    const reason = window.prompt("可選填結束聊天室的原因") || "";
    const { error: closeError } = await supabase.rpc("close_conversation", {
      target_conversation_id: conversation.id,
      reason,
    });
    if (closeError) setError(closeError.message);
    else onChanged();
  }

  async function blockUser() {
    if (!supabase || !window.confirm("封鎖後雙方不能再傳送訊息，仍要封鎖嗎？")) return;
    const { error: blockError } = await supabase.rpc("set_user_block", {
      target_user_id: otherUserId,
      should_block: true,
    });
    if (blockError) setError(blockError.message);
    else onChanged();
  }

  async function reportChat(messageId?: string) {
    if (!supabase) return;
    const details = window.prompt("請簡短說明檢舉原因")?.trim();
    if (!details) return;
    const { error: reportError } = await supabase.rpc("submit_chat_report", {
      target_conversation_id: conversation.id,
      target_message_id: messageId || null,
      report_reason: "other",
      report_details: details,
    });
    setError(reportError ? reportError.message : "檢舉已送出，管理員將進行審查");
  }

  return (
    <div className="trade-chat">
      <div className="trade-chat-head">
        <div><b>{senderName(otherUserId)}</b><small>每則最多 5 張圖片、每張 5MB；請勿傳送密碼、驗證碼或其他敏感資料。</small></div>
        <div>
          <button type="button" onClick={() => void reportChat()}><Flag size={14} />檢舉</button>
          <button type="button" onClick={() => void blockUser()}><Ban size={14} />封鎖</button>
          {conversation.status === "active" && <button type="button" onClick={() => void closeChat()}><X size={14} />結束</button>}
        </div>
      </div>
      <div className="trade-chat-log">
        {loading && <p className="trade-chat-empty">載入訊息中...</p>}
        {!loading && hasOlderMessages && (
          <button className="chat-load-older" type="button" disabled={loadingOlder} onClick={() => void loadOlderMessages()}>
            {loadingOlder ? "載入中..." : "載入較早訊息"}
          </button>
        )}
        {error && <p className="trade-chat-error">{error}</p>}
        {!loading && messages.length === 0 && <p className="trade-chat-empty">尚未開始對話，先打聲招呼吧。</p>}
        {messages.map((message) => (
          <div className={`trade-chat-bubble ${message.senderId === currentUserId ? "mine" : "theirs"}`} key={message.id}>
            <small>{message.senderId === currentUserId ? "我" : senderName(message.senderId)}</small>
            {message.recalledAt ? <p className="recalled">訊息已收回</p> : (
              <>
                {message.body && <p>{message.body}</p>}
                {message.imagePaths.length > 0 && (
                  <div className="chat-images">
                    {message.imagePaths.map((path) => imageUrls[path]
                      ? (
                        <button
                          className="chat-image-button"
                          type="button"
                          key={path}
                          onClick={() => setEnlargedImageUrl(imageUrls[path])}
                          aria-label="放大聊聊圖片"
                        >
                          <img src={imageUrls[path]} alt="聊聊圖片" />
                        </button>
                      )
                      : <span key={path}>圖片載入中</span>)}
                  </div>
                )}
                <div className="message-tools">
                  <button type="button" onClick={() => void reportChat(message.id)}>檢舉</button>
                  {message.senderId === currentUserId
                    && Date.now() - new Date(message.createdAt).getTime() <= 10 * 60_000
                    && <button type="button" onClick={() => void recall(message.id)}>收回</button>}
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="trade-chat-phrases">
        <small>常用語句</small>
        <div>{CHAT_PHRASES.map((phrase) => <button type="button" key={phrase} onClick={() => setDraft(phrase)}>{phrase}</button>)}</div>
      </div>
      {conversation.status === "active" ? (
        <form className="trade-chat-compose" onSubmit={(event) => void submitMessage(event)}>
          <label className="chat-image-picker" title="加入圖片">
            <ImagePlus size={18} />
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="輸入訊息..." maxLength={500} />
          <button type="submit" disabled={(!draft.trim() && files.length === 0) || sending}>{sending ? "傳送中" : "送出"}</button>
          {files.length > 0 && <small className="selected-images">已選擇 {files.length} 張圖片</small>}
        </form>
      ) : <p className="chat-readonly">這個聊天室已結束，紀錄保持唯讀。你可從書籍頁重新建立聊天室。</p>}
      {enlargedImageUrl && (
        <div className="chat-image-lightbox" role="dialog" aria-modal="true" aria-label="放大的聊聊圖片" onMouseDown={() => setEnlargedImageUrl(null)}>
          <button type="button" className="chat-image-lightbox-close" onClick={() => setEnlargedImageUrl(null)} aria-label="關閉圖片">
            <X size={24} />
          </button>
          <img src={enlargedImageUrl} alt="放大的聊聊圖片" onMouseDown={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

function EmptyDashboard({ text }: { text: string }) {
  return <div className="empty small"><Clock3 size={34} /><h3>{text}</h3><p>新的進度會出現在這裡。</p></div>;
}
