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
import { FormEvent, useEffect, useMemo, useState } from "react";
import { demoBooks, demoProfiles, demoRequests, departments } from "@/lib/demo-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Book,
  BookStatus,
  Notification,
  NotificationType,
  Profile,
  PurchaseRequest,
  Report,
  ReportReason,
  ReportTargetType,
  RequestStatus,
  ReviewStatus,
  TradeContact,
  UserRole,
} from "@/lib/types";

const STORAGE_KEY = "bookflow-market-v1";

type View = "home" | "book" | "dashboard" | "admin";
type DashboardTab = "listings" | "requests" | "received";
type Modal = "login" | "resetPassword" | "bookForm" | "request" | "report" | null;

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

const blankBook: Omit<Book, "id" | "sellerId" | "createdAt" | "status" | "reviewStatus" | "reviewNote" | "moderationVisibility"> = {
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

function mapBook(row: Record<string, unknown>): Book {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    title: String(row.title),
    author: String(row.author),
    department: String(row.department || ""),
    course: String(row.course || ""),
    teacher: String(row.teacher || ""),
    edition: String(row.edition || ""),
    condition: String(row.condition),
    price: Number(row.price),
    imageUrl: String(row.image_url),
    meetup: String(row.meetup),
    description: String(row.description || ""),
    status: row.status as BookStatus,
    reviewStatus: (row.review_status || "pending") as ReviewStatus,
    reviewNote: String(row.review_note || ""),
    moderationVisibility: String(row.moderation_visibility || "visible") as Book["moderationVisibility"],
    createdAt: String(row.created_at),
  };
}

function mapRequest(row: Record<string, unknown>): PurchaseRequest {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    buyerId: String(row.buyer_id),
    message: String(row.message),
    status: row.status as RequestStatus,
    createdAt: String(row.created_at),
  };
}

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    bookId: row.book_id ? String(row.book_id) : null,
    requestId: row.request_id ? String(row.request_id) : null,
    title: String(row.title),
    message: String(row.message || ""),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapReport(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    reporterId: String(row.reporter_id),
    reporterName: String(row.reporter_name || "使用者"),
    targetType: row.target_type as ReportTargetType,
    targetId: String(row.target_id),
    targetName: String(row.target_name || "未知對象"),
    bookId: row.book_id ? String(row.book_id) : null,
    bookTitle: row.book_title ? String(row.book_title) : null,
    reason: row.reason as ReportReason,
    details: String(row.details || ""),
    status: row.status as Report["status"],
    resolutionNote: String(row.resolution_note || ""),
    createdAt: String(row.created_at),
  };
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [contacts, setContacts] = useState<Record<string, TradeContact>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string; label: string } | null>(null);

  async function refreshMarketplace(user: Profile | null = store.currentUser) {
    if (!supabase) return;
    const client = supabase;
    const [
      { data: bookRows, error: booksError },
      { data: publicProfileRows, error: profilesError },
      requestResult,
      notificationResult,
      partyProfileResult,
      adminProfileResult,
      reportsResult,
    ] = await Promise.all([
      client.from("books").select("*").order("created_at", { ascending: false }),
      client.rpc("get_public_profiles"),
      user
        ? client.from("purchase_requests").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      user
        ? client.from("notifications").select("*").order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: null, error: null }),
      user
        ? client.rpc("get_request_party_profiles")
        : Promise.resolve({ data: null, error: null }),
      user?.role === "admin"
        ? client.rpc("list_profiles_for_admin")
        : Promise.resolve({ data: null, error: null }),
      user && ["admin", "moderator"].includes(user.role)
        ? client.rpc("list_reports_for_moderation")
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (booksError) {
      setToast(`讀取刊登失敗：${booksError.message}`);
      return;
    }
    if (profilesError) {
      setToast(`讀取會員顯示資料失敗：${profilesError.message}`);
      return;
    }
    if (requestResult.error) {
      setToast(`讀取交易資料失敗：${requestResult.error.message}`);
      return;
    }
    if (notificationResult.error) {
      setToast(`讀取通知失敗：${notificationResult.error.message}`);
      return;
    }
    if (partyProfileResult.error) {
      setToast(`讀取交易對象資料失敗：${partyProfileResult.error.message}`);
      return;
    }
    if (adminProfileResult.error) {
      setToast(`讀取會員管理資料失敗：${adminProfileResult.error.message}`);
      return;
    }
    if (reportsResult.error) {
      setToast(`讀取檢舉資料失敗：${reportsResult.error.message}`);
      return;
    }

    const publicProfiles: Profile[] = (publicProfileRows ?? []).map((row: Record<string, string>) => ({
      id: String(row.id),
      name: String(row.name),
      email: "",
      department: String(row.department || ""),
      role: "user",
      accountStatus: "active",
      suspendedAt: null,
      suspensionReason: "",
    }));
    const partyProfiles: Profile[] = (partyProfileResult.data ?? []).map((row: Record<string, string>) => ({
      id: String(row.id),
      name: String(row.name),
      email: "",
      department: String(row.department || ""),
      role: "user",
      accountStatus: "active",
      suspendedAt: null,
      suspensionReason: "",
    }));
    const adminProfiles: Profile[] = (adminProfileResult.data ?? []).map((row: Record<string, string>) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      department: String(row.department || ""),
      role: (row.role || "user") as UserRole,
      accountStatus: (row.account_status || "active") as Profile["accountStatus"],
      suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
      suspensionReason: String(row.suspension_reason || ""),
    }));
    const profileMap = new Map(publicProfiles.map((profile) => [profile.id, profile]));
    for (const profile of partyProfiles) profileMap.set(profile.id, profile);
    for (const profile of adminProfiles) profileMap.set(profile.id, profile);
    if (user) profileMap.set(user.id, user);

    const requests = (requestResult.data ?? []).map((row: Record<string, unknown>) => mapRequest(row));
    const acceptedRequests = requests.filter((request) => request.status === "accepted");
    const contactEntries = user
      ? await Promise.all(
          acceptedRequests.map(async (request) => {
            const { data } = await client.rpc("get_trade_contact", {
              target_request_id: request.id,
            });
            const contact = data?.[0];
            return contact
              ? [request.id, {
                  id: contact.id,
                  name: contact.name,
                  email: contact.email,
                  department: contact.department,
                } satisfies TradeContact] as const
              : null;
          }),
        )
      : [];

    setStore((previous) => ({
      ...previous,
      books: (bookRows ?? []).map((row) => mapBook(row)),
      requests,
      profiles: [...profileMap.values()],
      currentUser: user,
    }));
    setNotifications((notificationResult.data ?? []).map((row: Record<string, unknown>) => mapNotification(row)));
    setContacts(Object.fromEntries(contactEntries.filter((entry) => entry !== null)));
    setReports((reportsResult.data ?? []).map((row: Record<string, unknown>) => mapReport(row)));
  }

  useEffect(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setReady(true);
    if (supabase) void refreshMarketplace(null);
    // Initial remote load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !supabase) return;
    const client = supabase;

    const syncUser = async (user: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null) => {
      if (!user?.email) {
        setStore((previous) => ({ ...previous, currentUser: null }));
        await refreshMarketplace(null);
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
        setStore((previous) => ({ ...previous, currentUser: null }));
        await refreshMarketplace(null);
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

      setStore((previous) => ({
        ...previous,
        profiles: previous.profiles.some((profile) => profile.id === googleProfile.id)
          ? previous.profiles.map((profile) => (profile.id === googleProfile.id ? googleProfile : profile))
          : [...previous.profiles, googleProfile],
        currentUser: googleProfile,
      }));
      await refreshMarketplace(googleProfile);
    };

    void client.auth.getSession().then(({ data }) => void syncUser(data.session?.user ?? null));
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setModal("resetPassword");
      window.setTimeout(() => void syncUser(session?.user ?? null), 0);
    });

    return () => data.subscription.unsubscribe();
  }, [ready]);

  useEffect(() => {
    if (!supabase || !store.currentUser) return;
    const client = supabase;
    const user = store.currentUser;
    const channel = client
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void refreshMarketplace(user),
      )
      .subscribe();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshMarketplace(user);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void client.removeChannel(channel);
    };
    // Refresh uses the latest remote state for this authenticated user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentUser?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function dispatchEmailNotifications() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;
    await fetch("/api/notifications/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return store.books
      .filter((book) => book.reviewStatus === "approved")
      .filter((book) => book.moderationVisibility === "visible")
      .filter((book) => book.status !== "sold")
      .filter((book) => department === "全部科系" || book.department === department)
      .filter((book) => maxPrice === "不限價格" || book.price <= Number(maxPrice))
      .filter((book) =>
        !normalized
          ? true
          : [book.title, book.author, book.course, book.teacher]
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
      .select("account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    setModal(null);
    setToast(profile?.account_status === "suspended" ? "已登入；你的帳號目前為唯讀模式" : "登入成功");
    return null;
  }

  async function signUpWithPassword(name: string, department: string, email: string, password: string) {
    if (!supabase) return "請先完成 Supabase Email 驗證設定";
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

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setStore((previous) => ({ ...previous, requests: [], currentUser: null }));
    setNotifications([]);
    setContacts({});
    setNotificationOpen(false);
    setView("home");
    setToast("已安全登出");
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能刊登或修改商品");
      return;
    }
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(data.entries());
    const image = data.get("image");
    let imageUrl = editingBook?.imageUrl ?? "";

    if (image instanceof File && image.size > 0) {
      if (!supabase) {
        setToast("圖片上傳服務尚未完成設定");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        setToast("圖片僅支援 JPG、PNG 或 WebP");
        return;
      }
      if (image.size > 5 * 1024 * 1024) {
        setToast("圖片大小不能超過 5MB");
        return;
      }

      const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("book-images")
        .upload(filePath, image, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setToast(`圖片上傳失敗：${uploadError.message}`);
        return;
      }

      imageUrl = supabase.storage.from("book-images").getPublicUrl(filePath).data.publicUrl;
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
    };

    if (supabase) {
      const dbPayload = {
        seller_id: currentUser.id,
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
      const { seller_id: _sellerId, ...updatePayload } = dbPayload;
      const { error } = editingBook
        ? await supabase.from("books").update({ ...updatePayload, updated_at: new Date().toISOString() }).eq("id", editingBook.id)
        : await supabase.from("books").insert(dbPayload);

      if (error) {
        setToast(`刊登儲存失敗：${error.message}`);
        return;
      }
      await refreshMarketplace(currentUser);
      setEditingBook(null);
      setModal(null);
      setView("dashboard");
      setDashboardTab("listings");
      setToast(editingBook ? "修改已送回審核" : "刊登已送出，等待管理員審核");
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

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !selectedBook) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能送出購買意願");
      return;
    }
    const message = String(new FormData(event.currentTarget).get("message") || "").trim();
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
    if (supabase) {
      const { error } = await supabase.from("purchase_requests").insert({
        book_id: selectedBook.id,
        buyer_id: currentUser.id,
        message,
      });
      if (error) {
        setToast(error.code === "23505" ? "你已送出過購買意願" : `送出失敗：${error.message}`);
        return;
      }
      await refreshMarketplace(currentUser);
      void dispatchEmailNotifications();
      setModal(null);
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
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setModal(null);
    setToast("購買意願已送出");
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
      await refreshMarketplace(currentUser);
      void dispatchEmailNotifications();
      setToast(status === "accepted" ? "已接受意願，雙方聯絡資訊已開放" : "已婉拒這筆意願");
      return;
    }
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

  async function cancelRequest(requestId: string) {
    if (!currentUser) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能操作交易");
      return;
    }
    if (supabase) {
      const { error } = await supabase
        .from("purchase_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("status", "pending");
      if (error) {
        setToast(`取消失敗：${error.message}`);
        return;
      }
      await refreshMarketplace(currentUser);
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

  async function updateBookStatus(bookId: string, status: BookStatus) {
    if (currentUser?.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能操作交易");
      return;
    }
    if (supabase && currentUser && status === "sold") {
      const { error } = await supabase.rpc("complete_trade", {
        target_book_id: bookId,
      });
      if (error) {
        setToast(`完成交易失敗：${error.message}`);
        return;
      }
      await refreshMarketplace(currentUser);
      void dispatchEmailNotifications();
      setToast("已標示為售出");
      return;
    }
    setStore((previous) => ({
      ...previous,
      books: previous.books.map((book) => (book.id === bookId ? { ...book, status } : book)),
    }));
    setToast(status === "sold" ? "已標示為售出" : "商品狀態已更新");
  }

  function deleteBook(bookId: string) {
    if (currentUser?.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能修改刊登");
      return;
    }
    if (supabase && currentUser) {
      void supabase.from("books").delete().eq("id", bookId).then(async ({ error }) => {
        if (error) {
          setToast(`下架失敗：${error.message}`);
          return;
        }
        await refreshMarketplace(currentUser);
        setToast("刊登已下架");
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
      setToast(`審核失敗：${error.message}`);
      return;
    }
    await refreshMarketplace(currentUser);
    void dispatchEmailNotifications();
    setToast(decision === "approved" ? "書籍已通過並公開上架" : "書籍已拒絕");
  }

  async function changeRole(userId: string, role: UserRole) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: userId,
      new_role: role,
    });
    if (error) {
      setToast(`權限更新失敗：${error.message}`);
      return;
    }
    await refreshMarketplace(currentUser);
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
      setToast(`處理檢舉失敗：${error.message}`);
      return;
    }
    await refreshMarketplace(currentUser);
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
      setToast(`更新帳號狀態失敗：${error.message}`);
      return;
    }
    await refreshMarketplace(currentUser);
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
      setToast(`恢復刊登失敗：${error.message}`);
      return;
    }
    await refreshMarketplace(currentUser);
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
  }

  function openNotification(notification: Notification) {
    if (!notification.readAt) void markNotificationRead(notification.id);
    setNotificationOpen(false);
    if (notification.bookId) {
      setSelectedId(notification.bookId);
      setView("book");
      return;
    }
    setView("dashboard");
  }

  const myListings = currentUser ? store.books.filter((book) => book.sellerId === currentUser.id) : [];
  const myRequests = currentUser ? store.requests.filter((request) => request.buyerId === currentUser.id) : [];
  const receivedRequests = currentUser
    ? store.requests.filter((request) => store.books.some((book) => book.id === request.bookId && book.sellerId === currentUser.id))
    : [];
  const isModerator = currentUser?.accountStatus === "active"
    && (currentUser.role === "admin" || currentUser.role === "moderator");
  const pendingReviews = store.books.filter((book) => book.reviewStatus === "pending");
  const pendingReports = reports.filter((report) => report.status === "pending");
  const hiddenBooks = store.books.filter((book) => book.moderationVisibility === "hidden");
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => setView("home")} aria-label="回首頁">
          <span className="brand-mark"><BookOpen size={23} /></span>
          <span><b>虎科書流</b><small>HUST BOOKFLOW</small></span>
        </button>
        <nav>
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>找課本</button>
          <button onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}>我要賣書</button>
          <button onClick={() => requireLogin(() => setView("dashboard"))}>我的交易</button>
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
          {currentUser?.accountStatus === "suspended" && (
            <div className="suspension-banner">
              <Ban size={18} />
              <div><b>帳號目前為唯讀模式</b><span>{currentUser.suspensionReason || "請聯絡管理員了解停權原因。"}</span></div>
            </div>
          )}
          <section className="hero">
            <div className="hero-glow one" />
            <div className="hero-glow two" />
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> 學長姐的書，學弟妹的下一站</span>
              <h1>讓知識繼續流動，<br /><em>一本書也不浪費。</em></h1>
              <p>在校園裡找到你需要的課本，省下一筆，也讓學長姐的筆記繼續發揮價值。</p>
              <div className="hero-search">
                <Search size={21} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋書名、課程或老師..." />
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
              <button className="sell-cta" disabled={currentUser?.accountStatus === "suspended"} onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}><Plus size={18} />刊登一本書</button>
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
                    {book.course && <span className="course-tag">{book.course}</span>}
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
                <span className="avatar">{profile(selectedBook.sellerId)?.name.slice(0, 1)}</span>
                <div><small>賣家</small><b>{profile(selectedBook.sellerId)?.name}</b><span>{profile(selectedBook.sellerId)?.department}</span></div>
                {currentUser?.id !== selectedBook.sellerId && (
                  <button className="report-link" onClick={() => openReport("user", selectedBook.sellerId, profile(selectedBook.sellerId)?.name || "賣家")}>
                    <Flag size={14} />檢舉賣家
                  </button>
                )}
              </div>
              {currentUser?.id === selectedBook.sellerId ? (
                <button className="primary wide" disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(selectedBook); setModal("bookForm"); }}><Pencil size={18} />編輯我的刊登</button>
              ) : (
                <button
                  className="primary wide"
                  disabled={selectedBook.status !== "available" || currentUser?.accountStatus === "suspended"}
                  onClick={() => requireActive(() => setModal("request"))}
                >
                  <MessageCircle size={18} />{selectedBook.status === "available" ? "我有興趣" : "目前洽談中"}
                </button>
              )}
              {currentUser?.id !== selectedBook.sellerId && (
                <button className="report-book-button" onClick={() => openReport("book", selectedBook.id, `《${selectedBook.title}》`)}>
                  <Flag size={15} />檢舉這筆刊登
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
            <div><span className="section-kicker">MY HUST BOOKFLOW</span><h1>嗨，{currentUser.name}</h1><p>管理你的刊登與購買意願。</p></div>
            <button className="primary" disabled={currentUser.accountStatus === "suspended"} onClick={() => requireActive(() => { setEditingBook(null); setModal("bookForm"); })}><Plus size={18} />刊登課本</button>
          </div>
          {currentUser.accountStatus === "suspended" && (
            <div className="readonly-notice"><Ban size={18} /><div><b>唯讀模式</b><span>{currentUser.suspensionReason || "你可以查看既有交易，但暫時不能新增或修改資料。"}</span></div></div>
          )}
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
                  <div className="listing-main"><span className={`status ${book.status}`}>{statusLabels[book.status]}</span><h3>{book.title}</h3><p>{book.course ? `${book.course} · ` : ""}{money(book.price)}</p></div>
                  <div className="row-actions">
                    {book.status === "negotiating" && <button onClick={() => updateBookStatus(book.id, "sold")}><Check size={16} />完成交易</button>}
                    <button disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(book); setModal("bookForm"); }}><Pencil size={16} />編輯</button>
                    <button disabled={currentUser.accountStatus === "suspended"} className="danger" onClick={() => deleteBook(book.id)}><Trash2 size={16} />下架</button>
                  </div>
                  <div className={`review-badge ${book.reviewStatus}`}>{reviewLabels[book.reviewStatus]}</div>
                  {book.reviewStatus === "rejected" && book.reviewNote && <p className="review-note">拒絕原因：{book.reviewNote}</p>}
                </div>
              ))}
              {myListings.length === 0 && <EmptyDashboard text="你還沒有刊登任何課本" />}
            </div>
          )}

          {dashboardTab === "requests" && (
            <div className="dashboard-list">
              {myRequests.map((request) => {
                const book = store.books.find((item) => item.id === request.bookId);
                const contact = contacts[request.id];
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <div className="request-icon"><MessageCircle /></div>
                    <div className="request-main"><span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span><h3>{book.title}</h3><p>「{request.message}」</p>{request.status === "accepted" && contact && <div className="contact-box"><Check size={16} />賣家聯絡方式：<b>{contact.email}</b></div>}</div>
                    {request.status === "pending" && <div className="request-actions"><button onClick={() => void cancelRequest(request.id)}><X size={16} />取消意願</button></div>}
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
                const contact = contacts[request.id];
                if (!book) return null;
                return (
                  <div className="request-row" key={request.id}>
                    <span className="avatar">{buyer?.name.slice(0, 1)}</span>
                    <div className="request-main"><span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span><h3>{buyer?.name} 想買《{book.title}》</h3><p>「{request.message}」</p>{request.status === "accepted" && contact && <div className="contact-box"><Check size={16} />買家聯絡方式：<b>{contact.email}</b></div>}</div>
                    {request.status === "pending" && <div className="request-actions"><button className="accept" onClick={() => void respondToRequest(request.id, "accepted")}><Check size={16} />接受</button><button onClick={() => void respondToRequest(request.id, "rejected")}><X size={16} />婉拒</button></div>}
                    {buyer && <button className="report-inline" onClick={() => openReport("user", buyer.id, buyer.name)}><Flag size={14} />檢舉買家</button>}
                  </div>
                );
              })}
              {receivedRequests.length === 0 && <EmptyDashboard text="目前還沒有人送出購買意願" />}
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
          onLogin={loginWithPassword}
          onSignUp={signUpWithPassword}
          onVerifySignup={verifySignupCode}
          onResendSignup={resendSignupCode}
          onRequestReset={requestPasswordReset}
        />
      )}
      {modal === "resetPassword" && (
        <ResetPasswordModal
          configured={isSupabaseConfigured}
          onClose={() => setModal(null)}
          onSubmit={updatePassword}
        />
      )}
      {modal === "bookForm" && <BookFormModal book={editingBook} onClose={() => { setModal(null); setEditingBook(null); }} onSubmit={saveBook} />}
      {modal === "request" && selectedBook && <RequestModal book={selectedBook} onClose={() => setModal(null)} onSubmit={sendRequest} />}
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

function LoginModal({
  configured,
  onClose,
  onLogin,
  onSignUp,
  onVerifySignup,
  onResendSignup,
  onRequestReset,
}: {
  configured: boolean;
  onClose: () => void;
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

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setSignupStep("form");
    setCode("");
    setError("");
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
    if (!department) {
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
    else setSignupStep("code");
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
    setLoading(true);
    setError("");
    const message = await onResendSignup(email.trim());
    setLoading(false);
    if (message) setError(message);
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
          <div className="auth-tabs" role="tablist" aria-label="會員驗證方式">
            <button className={mode === "login" ? "active" : ""} type="button" onClick={() => switchMode("login")}>登入</button>
            <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => switchMode("signup")}>註冊</button>
          </div>
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
            <p>填寫基本資料後，我們會寄送 Email 驗證碼確認身分。</p>
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
            <h3>輸入 Email 驗證碼</h3>
            <p>驗證碼已寄到 <b>{email}</b>。沒有看到時，請檢查垃圾郵件。</p>
            <form className="otp-form" onSubmit={confirmCode}>
              <label>
                驗證碼
                <input
                  autoFocus
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}|[0-9]{8}"
                  minLength={6}
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="輸入 6 或 8 位數字"
                  required
                />
              </label>
              <button className="primary wide" type="submit" disabled={loading || ![6, 8].includes(code.length)}>
                {loading ? "驗證中..." : "完成註冊"}
              </button>
              <div className="auth-link-row">
                <button className="text-button" type="button" disabled={loading} onClick={() => { setSignupStep("form"); setCode(""); setError(""); }}>
                  返回修改資料
                </button>
                <button className="text-button" type="button" disabled={loading} onClick={() => void resendCode()}>
                  重新寄送驗證碼
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

function BookFormModal({ book, onClose, onSubmit }: { book: Book | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const value = book ?? blankBook;
  const [preview, setPreview] = useState(value.imageUrl);

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return <ModalShell title={book ? "編輯刊登" : "刊登一本課本"} subtitle="標示 * 的欄位為必填" onClose={onClose}><form onSubmit={onSubmit} className="form book-form"><label className="full">書名 *<input name="title" required defaultValue={value.title} placeholder="例如：資料結構：使用 C++" /></label><label>作者 *<input name="author" required defaultValue={value.author} /></label><label>版本 *<input name="edition" required defaultValue={value.edition} placeholder="例如：第 2 版" /></label><label>科系（選填）<select name="department" defaultValue={value.department}><option value="">不指定科系</option>{departments.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>課程（選填）<input name="course" defaultValue={value.course} /></label><label>授課老師（選填）<input name="teacher" defaultValue={value.teacher} /></label><label>書況 *<select name="condition" required defaultValue={value.condition}><option>近全新</option><option>書況良好</option><option>有筆記</option><option>使用痕跡明顯</option><option>損壞嚴重</option></select></label><label>價格（NT$）*<input name="price" required type="number" min="0" defaultValue={value.price || ""} /></label><label className="full">面交地點 *<input name="meetup" required defaultValue={value.meetup} placeholder="例如：圖書館一樓" /></label><label className="full">封面圖片 *<span className="image-upload"><input name="image" required={!book} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><ImagePlus size={22} /><b>{book ? "選擇新圖片（不選則保留原圖）" : "選擇圖片檔"}</b><small>支援 JPG、PNG、WebP，最大 5MB</small></span></label>{preview && <div className="image-preview full"><img src={preview} alt="書籍封面預覽" /></div>}<label className="full">書況說明 *<textarea name="description" required rows={3} defaultValue={value.description} /></label><button className="primary wide full" type="submit">{book ? "儲存變更" : "確認刊登"}</button></form></ModalShell>;
}

function RequestModal({ book, onClose, onSubmit }: { book: Book; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalShell title="送出購買意願" subtitle={`想購買《${book.title}》`} onClose={onClose}><form onSubmit={onSubmit} className="form"><div className="request-summary"><span>{book.condition}</span><b>{money(book.price)}</b><span><MapPin size={14} />{book.meetup}</span></div><label>給賣家的留言<textarea name="message" required rows={4} placeholder="介紹一下方便面交的時間，或想確認的書況..." /></label><button className="primary wide" type="submit"><MessageCircle size={17} />送出購買意願</button><p className="form-note">送出後不代表完成交易，請等待賣家接受。</p></form></ModalShell>;
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

function EmptyDashboard({ text }: { text: string }) {
  return <div className="empty small"><Clock3 size={34} /><h3>{text}</h3><p>新的進度會出現在這裡。</p></div>;
}
