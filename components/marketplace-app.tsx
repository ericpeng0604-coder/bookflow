"use client";

import {
  ArrowLeft,
  ArrowRight,
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
  HelpCircle,
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
  Sparkles,
  Trash2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { demoBooks, demoProfiles, demoRequests, departments } from "@/lib/demo-data";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  type AdminWorkspace,
  type DashboardTab,
  useMarketplaceNavigation,
} from "@/components/marketplace/navigation-state";
import {
  BOOK_IMAGE_CACHE_CONTROL,
  compressBookImage,
  compressBookOcrImage,
  extractStoragePath,
} from "@/lib/marketplace/image-upload";
import {
  clearLegacyFavorites,
  legacyFavoritesNeedSync,
  readFavoriteIds,
} from "@/lib/marketplace/favorites";
import { ALL_ITEM_CATEGORIES, isAllDepartments, MIN_PRICE_500, NO_MAX_PRICE, NO_MIN_PRICE, buildMarketplaceFilters } from "@/lib/marketplace/filters";
import {
  type BrowserPushState,
  browserPushState,
  currentPushSubscription,
  disableBrowserPush,
  dispatchBrowserPush,
  enableBrowserPush,
} from "@/lib/marketplace/browser-push";
import { findStudentIdCandidates, isStudentIdYearEligible, type StudentIdDetails } from "@/lib/marketplace/student-id";
import type {
  StudentVerificationFlags,
  BookOcrDraft,
} from "@/lib/marketplace/free-ocr";
import { reviewStudentVerificationWithStorage } from "@/lib/marketplace/student-verification";
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
  fetchActiveRequestForBook,
  fetchBookById,
  fetchFavoriteIds,
  fetchImageSearchCandidates,
  fetchMarketplacePage,
  fetchProfilesByIds,
  fetchMyReviewStatus,
  fetchPublicTrustBadges,
  submitTradeReview,
  fetchUnreadNotificationCount,
  DEFAULT_RISK_MODERATION_FILTERS,
  fetchRiskModerationSummary,
  fetchRiskProfileDetail,
  fetchRiskProfilesForModeration,
  updateRiskReviewStatus,
  loadModerationData,
  loadWorkspaceTabData,
  mergeProfiles,
  fetchNotifications,
  RISK_REVIEW_PAGE_SIZE,
  type RiskModerationFilters,
} from "@/lib/marketplace/queries";
import { isAbortError, runGuarded } from "@/lib/marketplace/refresh-guard";
import {
  LISTING_FIELD_LIMITS,
  normalizeAndValidateListingFields,
} from "@/lib/marketplace/listing-validation";
import { buildImageSearchPlan, rankImageSearchResults } from "@/lib/marketplace/image-search";
import {
  TAIWAN_TEXTBOOK_CATALOG_VERSION,
  normalizeTaiwanTextbookQuery,
  rankTaiwanTextbookCandidates,
} from "@/lib/marketplace/taiwan-textbook";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Book,
  BookStatus,
  Conversation,
  Feedback,
  Notification,
  Profile,
  PurchaseRequest,
  Report,
  ReportReason,
  ReportTargetType,
  RequestStatus,
  ReviewStatus,
  SellerLifecycle,
  StudentVerification,
  StudentVerificationSummary,
  TradeContact,
  TradeMessage,
  TradeReviewTag,
  TrustBadge,
  RiskPolicy,
  RiskProfile,
  RiskProfileSummary,
  RiskModerationSummary,
  RiskReviewStatus,
  ListingType,
  UserRole,
} from "@/lib/types";

const ACTIVE_REQUEST_CHECK_TIMEOUT_MS = 8_000;

const STORAGE_KEY = "bookflow-market-v1";
const PUSH_PROMPT_KEY = "bookflow-push-prompt-seen-v1";
const LAST_CHAT_KEY = "bookflow-last-chat-v1";
const IMAGE_SEARCH_MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_SEARCH_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MESSAGE_RECALL_WINDOW_MS = 10 * 60_000;
const pushPromptStorageKey = (userId: string) => `${PUSH_PROMPT_KEY}:${userId}`;
const lastChatStorageKey = (userId: string) => `${LAST_CHAT_KEY}:${userId}`;
const listingDepartmentStorageKey = (userId: string) => `bookflow-last-book-department-v1:${userId}`;
const listingDraftStorageKey = (
  userId: string,
  listingType: ListingType,
  bookId?: string,
) => `bookflow-listing-draft-v1:${userId}:${bookId || `new-${listingType}`}`;
const moneyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function safeImageSource(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("blob:")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

type Modal = "login" | "adminOtp" | "resetPassword" | "profile" | "bookForm" | "contactSettings" | "request" | "report" | "feedback" | "tradeReview" | null;

type Store = {
  books: Book[];
  requests: PurchaseRequest[];
  profiles: Profile[];
  currentUser: Profile | null;
};

type ActionDialogRequest = {
  id: number;
  title: string;
  message: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  initialValue?: string;
  minLength?: number;
  confirmLabel?: string;
  danger?: boolean;
};

function useActionDialog() {
  const [dialog, setDialog] = useState<ActionDialogRequest | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const sequence = useRef(0);

  const ask = useCallback((request: Omit<ActionDialogRequest, "id">) => (
    new Promise<string | null>((resolve) => {
      resolver.current?.(null);
      resolver.current = resolve;
      sequence.current += 1;
      setDialog({ ...request, id: sequence.current });
    })
  ), []);

  const cancel = useCallback(() => {
    resolver.current?.(null);
    resolver.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((value: string) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  }, []);

  useEffect(() => () => resolver.current?.(null), []);

  return { dialog, ask, cancel, confirm };
}

const NOTIFICATION_REFRESH_INTERVAL_MS = 120_000;
const ADMIN_MODERATION_REFRESH_INTERVAL_MS = 10_000;
const ADMIN_MODERATION_REFRESH_DEBOUNCE_MS = 400;
const SECONDHAND_CATEGORIES = [ALL_ITEM_CATEGORIES, "3C 電子", "文具用品", "宿舍生活", "服飾配件", "運動休閒", "其他"];
const DEFAULT_SECONDHAND_CATEGORY = SECONDHAND_CATEGORIES[1];

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
const REQUEST_COORDINATION_MAX_LENGTH = 120;

const statusLabels: Record<BookStatus, string> = {
  available: "販售中",
  negotiating: "已保留",
  sold: "已售出",
};

const requestLabels: Record<RequestStatus, string> = {
  pending: "等待賣家確認",
  waitlisted: "候補中",
  reserved: "賣家已選定",
  awaiting_confirmation: "等待買家確認",
  completed: "交易完成",
  rejected: "未被選定",
  cancelled: "已取消",
  expired: "已失效",
};

function sellerRequestNextStep(request: PurchaseRequest) {
  if (request.status === "reserved") {
    return hasRequestCoordination(request)
      ? "你已選定買家，可先核對對方填寫的面交時間與地點，再用聊聊確認細節。"
      : "你已選定買家，但對方還沒填好面交時間或地點；可先用聊聊確認，再安排面交。";
  }
  if (request.status === "awaiting_confirmation") return "你已確認面交，正在等待買家確認收到。";
  if (request.status === "completed") return "這筆交易已完成，紀錄與聊天室仍可用來回查。";
  if (request.status === "pending" || request.status === "waitlisted") return "尚未選定買家，確認前可先用聊聊溝通。";
  return "";
}

function hasRequestCoordination(request: Pick<PurchaseRequest, "preferredMeetupLocation" | "preferredMeetupTime">) {
  return Boolean(request.preferredMeetupLocation.trim() || request.preferredMeetupTime.trim());
}

function requestCoordinationLines(request: Pick<PurchaseRequest, "preferredMeetupLocation" | "preferredMeetupTime">) {
  return [
    request.preferredMeetupLocation.trim() ? `希望地點：${request.preferredMeetupLocation.trim()}` : "",
    request.preferredMeetupTime.trim() ? `希望時間：${request.preferredMeetupTime.trim()}` : "",
  ].filter(Boolean);
}

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

const feedbackCategoryLabels: Record<string, string> = {
  suggestion: "功能建議",
  bug: "問題回報",
  experience: "使用體驗",
  other: "其他",
};

const blankBook: Omit<
  Book,
  | "id"
  | "sellerId"
  | "sellerVerified"
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
  listingType: "book",
  itemCategory: "book",
  title: "",
  author: "",
  department: "",
  course: "",
  teacher: "",
  edition: "",
  publisher: "",
  educationLevel: "",
  grade: "",
  semester: "",
  subject: "",
  volume: "",
  curriculum: "",
  bookType: "",
  isbn13: "",
  approvalNumber: "",
  condition: "書況良好",
  price: 0,
  imageUrl: "",
  meetup: "",
  description: "",
  contactMethod: "none",
  contactValue: "",
};

const EDUCATION_LEVEL_OPTIONS = [
  ["", "未指定"],
  ["elementary", "國小"],
  ["junior_high", "國中"],
  ["senior_high", "普通高中"],
  ["vocational_high", "技高／高職"],
  ["university", "大專院校"],
] as const;

const SEMESTER_OPTIONS = [
  ["", "未指定"],
  ["first", "上學期"],
  ["second", "下學期"],
] as const;

const BOOK_TYPE_OPTIONS = [
  ["", "未指定"],
  ["textbook", "課本／教科書"],
  ["workbook", "習作"],
  ["teacher_guide", "教師手冊"],
  ["reference", "自修／講義"],
  ["assessment", "評量／題庫"],
  ["other", "其他"],
] as const;

function optionLabel(
  options: readonly (readonly [string, string])[],
  value: string,
) {
  return options.find(([option]) => option === value)?.[1] || value;
}

function textbookMetadata(book: Book) {
  return [
    optionLabel(EDUCATION_LEVEL_OPTIONS, book.educationLevel),
    book.grade ? `${book.grade}年級` : "",
    optionLabel(SEMESTER_OPTIONS, book.semester),
    book.subject,
    book.volume,
    book.curriculum,
    optionLabel(BOOK_TYPE_OPTIONS, book.bookType),
  ].filter(Boolean);
}

function visibleBookField(value: string) {
  const trimmed = value.trim();
  return trimmed && !trimmed.startsWith("不指定") ? trimmed : "";
}

function listingContextLabel(book: Book) {
  if (book.listingType === "secondhand") return visibleBookField(book.itemCategory);
  return [visibleBookField(book.department), visibleBookField(book.course)].filter(Boolean).join(" · ");
}

function cardContextLabel(book: Book) {
  return listingContextLabel(book) || visibleBookField(book.subject) || visibleBookField(book.course);
}

function studentVerificationFlagLabelsForDisplay(flags: StudentVerificationFlags) {
  const labels = [flags.schoolMatched ? "\u6821\u540d\u7591\u4f3c\u7b26\u5408" : "\u672a\u8fa8\u8b58\u5230\u864e\u79d1\u6821\u540d"];
  if (flags.imageTooSmall) labels.push("\u5716\u7247\u5c3a\u5bf8\u504f\u5c0f");
  return labels;
}

function money(value: number) {
  return moneyFormatter.format(value);
}

function timeAgo(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function dateLabel(value: string) {
  return dateFormatter.format(new Date(value));
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

function unreadNotificationIds(items: Notification[]) {
  const ids: string[] = [];
  for (const item of items) {
    if (!item.readAt) ids.push(item.id);
  }
  return ids;
}

function uniqueFavoriteBooks(knownBooks: Book[], favoriteIds: Set<string>) {
  const booksById = new Map<string, Book>();
  for (const book of knownBooks) {
    if (favoriteIds.has(book.id)) booksById.set(book.id, book);
  }
  return [...booksById.values()];
}

function matchesLocalMarketplaceBook(
  book: Book,
  options: {
    listingType: ListingType;
    itemCategory: string;
    department: string;
    minPrice: string;
    maxPrice: string;
    searchTokens: string[];
  },
) {
  if (book.reviewStatus !== "approved") return false;
  if (book.moderationVisibility !== "visible") return false;
  if (book.lifecycleState !== "active") return false;
  if (book.status === "sold") return false;
  if ((book.listingType || "book") !== options.listingType) return false;
  if (options.listingType !== "book" && options.itemCategory !== ALL_ITEM_CATEGORIES && book.itemCategory !== options.itemCategory) return false;
  if (options.listingType === "book" && !isAllDepartments(options.department) && book.department !== options.department) return false;
  if (options.minPrice && book.price < Number(options.minPrice)) return false;
  if (options.maxPrice && book.price > Number(options.maxPrice)) return false;
  if (options.searchTokens.length === 0) return true;

  const searchableText = [
    book.title,
    book.author,
    book.publisher,
    book.course,
    book.teacher,
    book.description,
    book.itemCategory,
    book.educationLevel,
    book.grade ? `${book.grade}年級` : "",
    optionLabel(SEMESTER_OPTIONS, book.semester),
    book.subject,
    book.volume,
    book.curriculum,
    optionLabel(BOOK_TYPE_OPTIONS, book.bookType),
    book.isbn13,
    book.approvalNumber,
  ].join(" ").toLowerCase();
  return options.searchTokens.every((token) => searchableText.includes(token));
}

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

async function deleteAccount() {
  if (!supabase) return "帳號刪除服務目前無法使用";
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return "登入狀態已失效，請重新登入";

  try {
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE" }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return result.error || "帳號刪除暫時無法完成";
    await supabase.auth.signOut().catch(() => undefined);
    window.location.assign("/");
    return null;
  } catch {
    return "帳號刪除請求逾時，請稍後再試；若公開資料已停止顯示，可再次操作完成登入帳號刪除";
  }
}

function validateImageSearchFile(file: File) {
  if (!IMAGE_SEARCH_ALLOWED_TYPES.has(file.type) || file.size > IMAGE_SEARCH_MAX_FILE_BYTES) {
    return "請上傳 5MB 以內的 JPG、PNG 或 WebP 書封照片";
  }
  return "";
}

function canRecallTradeMessage(message: TradeMessage, currentUserId: string, now: number | null) {
  return Boolean(
    now
    && message.senderId === currentUserId
    && now - new Date(message.createdAt).getTime() <= MESSAGE_RECALL_WINDOW_MS,
  );
}

export function MarketplaceApp() {
  const [store, setStore] = useState<Store>({ books: demoBooks, requests: demoRequests, profiles: demoProfiles, currentUser: null });
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const actionDialog = useActionDialog();
  const [query, setQuery] = useState("");
  const [listingType, setListingType] = useState<ListingType>("book");
  const [itemCategory, setItemCategory] = useState(ALL_ITEM_CATEGORIES);
  const [department, setDepartment] = useState(departments[0]);
  const [minPrice, setMinPrice] = useState(NO_MIN_PRICE);
  const [maxPrice, setMaxPrice] = useState(NO_MAX_PRICE);
  const [modal, setModal] = useState<Modal>(null);
  const [listingFormType, setListingFormType] = useState<ListingType>("book");
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
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>([]);
  const [riskProfiles, setRiskProfiles] = useState<RiskProfileSummary[]>([]);
  const [riskProfileTotal, setRiskProfileTotal] = useState(0);
  const [riskSummary, setRiskSummary] = useState<RiskModerationSummary | null>(null);
  const [riskFilters, setRiskFilters] = useState<RiskModerationFilters>(() => ({ ...DEFAULT_RISK_MODERATION_FILTERS }));
  const [riskPageLoading, setRiskPageLoading] = useState(false);
  const [selectedRiskProfileId, setSelectedRiskProfileId] = useState<string | null>(null);
  const [riskProfileDetail, setRiskProfileDetail] = useState<RiskProfile | null>(null);
  const [riskProfileDetailLoading, setRiskProfileDetailLoading] = useState(false);
  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy | null>(null);
  const [reviewRequest, setReviewRequest] = useState<PurchaseRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<{ reviewed: boolean; revieweeId: string; revieweeName: string } | null>(null);
  const [studentVerifications, setStudentVerifications] = useState<StudentVerification[]>([]);
  const [myStudentVerification, setMyStudentVerification] = useState<StudentVerificationSummary | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string; label: string } | null>(null);
  const [marketplaceBooks, setMarketplaceBooks] = useState<Book[]>([]);
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [imageSearchBusy, setImageSearchBusy] = useState(false);
  const [imageSearchProgress, setImageSearchProgress] = useState(0);
  const [imageSearchMessage, setImageSearchMessage] = useState("");
  const [imageSearchPreview, setImageSearchPreview] = useState("");
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchActive, setImageSearchActive] = useState(false);
  const [imageSearchResultCount, setImageSearchResultCount] = useState<number | null>(null);
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [requestBooks, setRequestBooks] = useState<Book[]>([]);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [bookDetailLoading, setBookDetailLoading] = useState(false);
  const [bookDetailMissing, setBookDetailMissing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteBookCache, setFavoriteBookCache] = useState<Book[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Book[]>([]);
  const [selectedAdminBook, setSelectedAdminBook] = useState<Book | null>(null);
  const [hiddenBooks, setHiddenBooks] = useState<Book[]>([]);
  const [sellerLifecycle, setSellerLifecycle] = useState<SellerLifecycle | null>(null);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<string>>(() => new Set());
  const [activeRequestCheckState, setActiveRequestCheckState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeRequestCheckRetry, setActiveRequestCheckRetry] = useState(0);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [pushState, setPushState] = useState<BrowserPushState>("disabled");
  const [pushSaving, setPushSaving] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showCourseSearchGuide, setShowCourseSearchGuide] = useState(false);
  const bookSavingRef = useRef(false);
  const requestSavingRef = useRef(false);
  const activeRequestCheckStartedRef = useRef<string | null>(null);
  const adminOtpRequestedRef = useRef<string | null>(null);
  const imageSearchInputRef = useRef<HTMLInputElement>(null);
  const imageSearchRequestRef = useRef(0);
  const marketplaceCursorRef = useRef<{ sellerVerified: boolean; createdAt: string; id: string } | null>(null);
  const badgeLookupRef = useRef<Set<string>>(new Set());
  const [bookSaving, setBookSaving] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const lastNotificationRefreshRef = useRef(0);
  const adminModerationDebounceRef = useRef<number | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);
  const debouncedRiskQuery = useDebouncedValue(riskFilters.query, 300);
  const appliedRiskFilters = useMemo(
    () => ({ ...riskFilters, query: debouncedRiskQuery }),
    [debouncedRiskQuery, riskFilters],
  );
  const currentUser = store.currentUser;
  const {
    adminWorkspace,
    dashboardTab,
    expandedConversationId,
    openBookRoute,
    openDashboard: showDashboard,
    returnToMarketRoute,
    selectedId,
    setDashboardTab,
    setAdminWorkspace,
    setExpandedConversationId,
    setSelectedId,
    setView,
    view,
  } = useMarketplaceNavigation({
    ready,
    listingType,
    currentUser,
    conversations,
    lastChatStorageKey,
    onListingTypeChange: setListingType,
    onBookRouteChange: clearBookDetailRouteState,
    onConversationRoute: openConversation,
  });

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
    () => buildMarketplaceFilters(listingType, itemCategory, department, maxPrice, debouncedQuery, minPrice),
    [listingType, itemCategory, department, maxPrice, minPrice, debouncedQuery],
  );

  useEffect(() => () => {
    if (imageSearchPreview.startsWith("blob:")) URL.revokeObjectURL(imageSearchPreview);
  }, [imageSearchPreview]);

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
    if (imageSearchActive && !append) return;
    await runGuarded("marketplace", async (signal) => {
      setMarketplaceLoading(true);
      try {
        const page = await fetchMarketplacePage(
          client,
          marketplaceFilters,
          append ? marketplaceCursorRef.current : null,
        );
        if (signal.aborted) return;
        setMarketplaceBooks((previous) => (append ? [...previous, ...page.books] : page.books));
        setMarketplaceHasMore(page.hasMore);
        marketplaceCursorRef.current = page.nextCursor;
      } catch (error) {
        if (!isAbortError(error)) {
          setToast(`讀取刊登失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      } finally {
        if (!signal.aborted) setMarketplaceLoading(false);
      }
    });
  }, [imageSearchActive, marketplaceFilters]);

  const loadMarketplaceCount = useCallback(async () => {
    if (imageSearchActive) return;
    try {
      const response = await fetch("/api/marketplace/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingType: marketplaceFilters.listingType,
          itemCategory: marketplaceFilters.itemCategory,
          department: marketplaceFilters.department,
          minPrice: marketplaceFilters.minPrice,
          maxPrice: marketplaceFilters.maxPrice,
          query: marketplaceFilters.query,
        }),
      });
      if (!response.ok) throw new Error("count unavailable");
      const result = await response.json() as { count: number | null };
      if (result.count !== null) setMarketplaceCount(result.count);
    } catch {
      setMarketplaceCount((previous) => Math.max(previous, marketplaceBooks.length));
    }
  }, [imageSearchActive, marketplaceBooks.length, marketplaceFilters]);

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
        if (workspace.trustBadges) {
          setTrustBadges((previous) => [
            ...new Map([...previous, ...workspace.trustBadges!].map((badge) => [`${badge.userId}:${badge.badgeType}`, badge])).values(),
          ]);
        }
        if (workspace.sellerLifecycle !== undefined) setSellerLifecycle(workspace.sellerLifecycle);
        if (workspace.studentVerification !== undefined) setMyStudentVerification(workspace.studentVerification);
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
    const tabs = tab === "requests" || tab === "received" || tab === "chats" || tab === "studentVerification"
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
        setFeedback(data.feedback);
        setStudentVerifications(data.studentVerifications);
        setRiskPolicy(data.riskPolicy);
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

  const loadRiskModeration = useCallback(async (user: Profile, filters: RiskModerationFilters) => {
    if (!supabase) return;
    const client = supabase;
    await runGuarded("risk-moderation", async (signal) => {
      setRiskPageLoading(true);
      try {
        const [page, summary] = await Promise.all([
          fetchRiskProfilesForModeration(client, filters),
          fetchRiskModerationSummary(client),
        ]);
        if (signal.aborted) return;
        setRiskProfiles(page.profiles);
        setRiskProfileTotal(page.total);
        setRiskSummary(summary);
      } catch (error) {
        if (await recoverAdminVerification(error instanceof Error ? error.message : "", user)) return;
        if (!isAbortError(error)) {
          setToast(`讀取交易風險失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
        }
      } finally {
        if (!signal.aborted) setRiskPageLoading(false);
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
        const unreadIds = unreadNotificationIds(items);
        setUnreadNotificationCount(unreadIds.length);
        lastNotificationRefreshRef.current = Date.now();

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

  const reloadAfterModerationMutation = useCallback(() => {
    if (!supabase || !store.currentUser) return;
    void Promise.all([
      loadModerationPanel(store.currentUser),
      loadMarketplaceBooks(),
    ]);
  }, [loadMarketplaceBooks, loadModerationPanel, store.currentUser]);

  const refreshModerationInBackground = useCallback(() => {
    if (!supabase || !store.currentUser) return;
    void Promise.all([
      loadModerationPanel(store.currentUser),
      loadRiskModeration(store.currentUser, appliedRiskFilters),
    ]);
  }, [appliedRiskFilters, loadModerationPanel, loadRiskModeration, store.currentUser]);

  const openDashboard = useCallback(() => {
    showDashboard();
    if (view === "dashboard" && store.currentUser) {
      void loadDashboardWorkspace(store.currentUser, dashboardTab);
    }
  }, [dashboardTab, loadDashboardWorkspace, showDashboard, store.currentUser, view]);

  const openDashboardTab = useCallback((tab: DashboardTab) => {
    showDashboard();
    setDashboardTab(tab);
  }, [setDashboardTab, showDashboard]);

  useEffect(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setFavoriteIds(readFavoriteIds());
    setOnline(navigator.onLine);
    setReady(true);
  }, []);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!ready || !supabase || imageSearchActive) return;
    marketplaceCursorRef.current = null;
    setMarketplaceCount(0);
    void Promise.all([loadMarketplaceBooks(), loadMarketplaceCount()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    marketplaceFilters.listingType,
    marketplaceFilters.itemCategory,
    marketplaceFilters.department,
    marketplaceFilters.minPrice,
    marketplaceFilters.maxPrice,
    marketplaceFilters.query,
    imageSearchActive,
  ]);

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
    if (!supabase || view !== "admin" || !store.currentUser) return;
    if (!["admin", "moderator"].includes(store.currentUser.role)) return;
    void loadModerationPanel(store.currentUser);
  }, [view, store.currentUser, loadModerationPanel]);

  useEffect(() => {
    if (!supabase || view !== "admin" || !store.currentUser) return;
    if (!["admin", "moderator"].includes(store.currentUser.role)) return;
    void loadRiskModeration(store.currentUser, appliedRiskFilters);
  }, [view, store.currentUser, appliedRiskFilters, loadRiskModeration]);

  useEffect(() => {
    if (!supabase || view !== "admin" || !store.currentUser) return;
    if (!["admin", "moderator"].includes(store.currentUser.role)) return;

    const client = supabase;
    const user = store.currentUser;
    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (adminModerationDebounceRef.current !== null) {
        window.clearTimeout(adminModerationDebounceRef.current);
      }
      adminModerationDebounceRef.current = window.setTimeout(() => {
        adminModerationDebounceRef.current = null;
        void Promise.all([
          loadModerationPanel(user),
          loadRiskModeration(user, appliedRiskFilters),
        ]);
      }, ADMIN_MODERATION_REFRESH_DEBOUNCE_MS);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    const channel = client
      .channel(`admin-moderation:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_verifications",
        },
        scheduleRefresh,
      )
      .subscribe();
    const interval = window.setInterval(refreshWhenVisible, ADMIN_MODERATION_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      if (adminModerationDebounceRef.current !== null) {
        window.clearTimeout(adminModerationDebounceRef.current);
        adminModerationDebounceRef.current = null;
      }
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      void client.removeChannel(channel);
    };
  }, [appliedRiskFilters, loadModerationPanel, loadRiskModeration, store.currentUser, view]);

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
      setBookDetailMissing(false);
      setBookDetailLoading(false);
      return;
    }
    setDetailBook(null);
    setBookDetailMissing(false);
    setBookDetailLoading(true);
    const client = supabase;
    const bookId = selectedId;
    void runGuarded("book-detail", async (signal) => {
      try {
        const book = await fetchBookById(client, bookId);
        if (signal.aborted) return;
        setDetailBook(book);
        setBookDetailMissing(!book);
      } catch (error) {
        if (!isAbortError(error)) {
          setDetailBook(null);
          setBookDetailMissing(true);
        }
      } finally {
        if (!signal.aborted) setBookDetailLoading(false);
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
    if (window.innerWidth <= 980) document.body.style.overflow = "hidden";
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeMenu);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeMenu);
    };
  }, [mobileMenuOpen]);

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
      const state = window.Notification?.permission === "denied" ? "denied" : "disabled";
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
      setPushState(window.Notification?.permission === "denied" ? "denied" : "disabled");
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
    if (imageSearchActive) return marketplaceBooks;
    if (supabase) return marketplaceBooks;
    const normalized = (listingType === "book"
      ? normalizeTaiwanTextbookQuery(query)
      : query.trim()).toLowerCase();
    const searchTokens = normalized.split(/\s+/).filter(Boolean);
    return store.books
      .filter((book) => matchesLocalMarketplaceBook(book, {
        listingType,
        itemCategory,
        department,
        minPrice,
        maxPrice,
        searchTokens,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [department, imageSearchActive, itemCategory, listingType, maxPrice, minPrice, query, store.books, marketplaceBooks]);

  const selectedBook = detailBook
    ?? filteredBooks.find((book) => book.id === selectedId)
    ?? myBooks.find((book) => book.id === selectedId)
    ?? requestBooks.find((book) => book.id === selectedId)
    ?? store.books.find((book) => book.id === selectedId)
    ?? null;
  const selectedSellerId = selectedBook?.sellerId ?? null;
  const selectedBookActiveRequest = currentUser && selectedBook
    ? store.requests.find((request) =>
      request.bookId === selectedBook.id
      && request.buyerId === currentUser.id
      && ["pending", "waitlisted", "reserved", "awaiting_confirmation", "completed"].includes(request.status)
    )
    : null;
  const currentUserRef = useRef(currentUser);
  const selectedBookRef = useRef(selectedBook);
  const selectedBookActiveRequestRef = useRef(selectedBookActiveRequest);
  currentUserRef.current = currentUser;
  selectedBookRef.current = selectedBook;
  selectedBookActiveRequestRef.current = selectedBookActiveRequest;
  const profile = (id: string) => store.profiles.find((item) => item.id === id);
  const badgeFor = (userId: string, badgeType: "seller" | "buyer") =>
    trustBadges.find((badge) => badge.userId === userId && badge.badgeType === badgeType && badge.status === "approved");

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

  useEffect(() => {
    const user = currentUserRef.current;
    const book = selectedBookRef.current;
    const activeRequest = selectedBookActiveRequestRef.current;
    const requestCheckKey = user && book && book.sellerId !== user.id && view === "book"
      ? `${book.id}:${user.id}`
      : null;
    if (!supabase || !user || !book || view !== "book" || book.sellerId === user.id) {
      activeRequestCheckStartedRef.current = null;
      setActiveRequestCheckState("idle");
      return;
    }
    if (activeRequest) {
      setActiveRequestCheckState("ready");
      return;
    }
    if (activeRequestCheckStartedRef.current === requestCheckKey) return;
    activeRequestCheckStartedRef.current = requestCheckKey;
    setActiveRequestCheckState("loading");
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) setActiveRequestCheckState("error");
    }, ACTIVE_REQUEST_CHECK_TIMEOUT_MS);
    void fetchActiveRequestForBook(supabase, book.id, user.id)
      .then((request) => {
        if (!active) return;
        if (request) {
          setStore((previous) => ({
            ...previous,
            requests: [
              request,
              ...previous.requests.filter((item) => item.id !== request.id),
            ],
          }));
        }
        setActiveRequestCheckState("ready");
      })
      .catch(() => {
        if (active) setActiveRequestCheckState("error");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeRequestCheckRetry, currentUser?.id, selectedBook?.id, selectedBook?.sellerId, selectedBookActiveRequest?.id, view]);

  function clearBookDetailRouteState() {
    setDetailBook(null);
    setBookDetailMissing(false);
    setDetailMenuOpen(false);
  }

  useEffect(() => {
    if (!supabase || !selectedSellerId || view !== "book" || badgeLookupRef.current.has(selectedSellerId)) return;
    badgeLookupRef.current.add(selectedSellerId);
    void fetchPublicTrustBadges(supabase, [selectedSellerId])
      .then((badges) => setTrustBadges((previous) => [
        ...previous.filter((badge) => !badges.some((item) => item.userId === badge.userId && item.badgeType === badge.badgeType)),
        ...badges,
      ]))
      .catch(() => badgeLookupRef.current.delete(selectedSellerId));
  }, [selectedSellerId, view]);

  function openBook(id: string) {
    const target = filteredBooks.find((book) => book.id === id)
      ?? myBooks.find((book) => book.id === id)
      ?? requestBooks.find((book) => book.id === id);
    openBookRoute(id, target?.listingType || listingType);
  }

  function returnToMarket() {
    returnToMarketRoute();
  }

  function switchListingType(nextType: ListingType) {
    setListingType(nextType);
    setSelectedId(null);
    clearBookDetailRouteState();
    setQuery("");
    setImageSearchActive(false);
    setImageSearchResultCount(null);
    setImageSearchQuery("");
    if (nextType === "book") {
      setItemCategory(ALL_ITEM_CATEGORIES);
    } else {
      setDepartment(departments[0]);
    }
  }

  function openListingForm(nextType: ListingType) {
    setEditingBook(null);
    setListingFormType(nextType);
    setModal("bookForm");
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

  async function submitStudentVerification(file: File, ocrText: string, qualityFlags: StudentVerificationFlags, studentNumber: string) {
    if (!supabase || !currentUser) return "目前無法上傳學生證";
    if (currentUser.accountStatus === "suspended") return "你的帳號目前為唯讀模式，不能送出學生證審核";

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("student-verifications")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) return "目前無法上傳學生證，請稍後再試。";

    const { error: rawError } = await supabase.rpc("submit_student_verification", {
      image_path: path,
      ocr_text: ocrText,
      quality_flags: qualityFlags,
      student_number: studentNumber,
    });
    if (rawError) {
      await supabase.storage.from("student-verifications").remove([path]);
      const message = rawError.message.toLowerCase();
      if (message.includes("pending")) return "你已有一筆審核中的學生證，請等待審核完成。";
      if (message.includes("daily") || message.includes("limit")) return "今日提交次數已達上限，請明天再試。";
      if (message.includes("active account") || message.includes("auth")) return "請重新登入後再試。";
      return "目前無法送出學生證審核，請稍後再試。";
    }

    setToast("學生證已送出，管理員會人工審核");
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
    setMyStudentVerification(null);
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

      const validated = normalizeAndValidateListingFields({
        title: String(fields.title),
        author: String(fields.author),
        edition: String(fields.edition),
        publisher: String(fields.publisher),
        course: String(fields.course),
        teacher: String(fields.teacher),
        meetup: String(fields.meetup),
        description: String(fields.description),
        educationLevel: String(fields.educationLevel || ""),
        grade: String(fields.grade || ""),
        semester: String(fields.semester || ""),
        subject: String(fields.subject || ""),
        volume: String(fields.volume || ""),
        curriculum: String(fields.curriculum || ""),
        bookType: String(fields.bookType || ""),
        isbn13: String(fields.isbn13 || ""),
        approvalNumber: String(fields.approvalNumber || ""),
        price: Number(fields.price),
      });
      if ("error" in validated) {
        if (uploadedImagePath) {
          await supabase?.storage.from("book-images").remove([uploadedImagePath]);
        }
        setToast(validated.error);
        return;
      }
      const clean = validated.value;
      const payload = {
        listingType: (String(fields.listingType) === "secondhand" ? "secondhand" : "book") as ListingType,
        itemCategory: String(fields.itemCategory || "book"),
        title: clean.title,
        author: clean.author,
        department: String(fields.department),
        course: clean.course,
        teacher: clean.teacher,
        edition: clean.edition,
        publisher: clean.publisher,
        educationLevel: clean.educationLevel,
        grade: clean.grade,
        semester: clean.semester,
        subject: clean.subject,
        volume: clean.volume,
        curriculum: clean.curriculum,
        bookType: clean.bookType,
        isbn13: clean.isbn13,
        approvalNumber: clean.approvalNumber,
        condition: String(fields.condition),
        price: clean.price,
        imageUrl,
        meetup: clean.meetup,
        description: clean.description,
        contactMethod: editingBook?.contactMethod ?? "none",
        contactValue: editingBook?.contactValue ?? "",
      };
      let ocrOriginal: Record<string, unknown> | null = null;
      try {
        const raw = String(fields.ocrOriginal || "");
        if (raw) ocrOriginal = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        ocrOriginal = null;
      }
      const correctedOcrFields = {
        title: payload.title,
        author: payload.author,
        edition: payload.edition,
      };

      if (payload.listingType === "book" && payload.department && !departments.slice(1).includes(payload.department)) {
        setToast("請從選單選擇正確的科系");
        return;
      }
      if (payload.listingType === "secondhand" && !SECONDHAND_CATEGORIES.slice(1).includes(payload.itemCategory)) {
        setToast("請選擇正確的二手分類");
        return;
      }

      if (supabase) {
        const updatePayload = {
          listing_type: payload.listingType,
          item_category: payload.listingType === "book" ? "book" : payload.itemCategory,
          title: payload.title,
          author: payload.author,
          department: payload.department,
          course: payload.course,
          teacher: payload.teacher,
          edition: payload.edition,
          publisher: payload.publisher,
          education_level: payload.listingType === "book" ? payload.educationLevel : "",
          grade: payload.listingType === "book" ? payload.grade : "",
          semester: payload.listingType === "book" ? payload.semester : "",
          subject: payload.listingType === "book" ? payload.subject : "",
          volume: payload.listingType === "book" ? payload.volume : "",
          curriculum: payload.listingType === "book" ? payload.curriculum : "",
          book_type: payload.listingType === "book" ? payload.bookType : "",
          isbn13: payload.listingType === "book" ? payload.isbn13 : "",
          approval_number: payload.listingType === "book" ? payload.approvalNumber : "",
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
        if (ocrOriginal && JSON.stringify(ocrOriginal) !== JSON.stringify(correctedOcrFields)) {
          await supabase.rpc("record_textbook_ocr_feedback", {
            original_metadata: ocrOriginal,
            corrected_metadata: correctedOcrFields,
            catalog_version: TAIWAN_TEXTBOOK_CATALOG_VERSION,
          });
        }
        await reloadAfterUserMutation();
        window.localStorage.removeItem(
          listingDraftStorageKey(currentUser.id, payload.listingType, editingBook?.id),
        );
        setEditingBook(null);
        setModal(null);
        openDashboardTab("listings");
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
                sellerVerified: false,
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
      window.localStorage.removeItem(
        listingDraftStorageKey(currentUser.id, payload.listingType, editingBook?.id),
      );
      setEditingBook(null);
      setModal(null);
      openDashboardTab("listings");
      setToast(editingBook ? "刊登內容已更新" : "書籍刊登成功");
    } finally {
      bookSavingRef.current = false;
      setBookSaving(false);
    }
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !selectedBook) return;
    if (requestSavingRef.current) return;
    if (currentUser.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能送出購買意願");
      return;
    }
    requestSavingRef.current = true;
    setRequestSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
    const message = String(formData.get("message") || "").trim();
    const preferredMeetupLocation = String(formData.get("preferredMeetupLocation") || "")
      .trim()
      .slice(0, REQUEST_COORDINATION_MAX_LENGTH);
    const preferredMeetupTime = String(formData.get("preferredMeetupTime") || "")
      .trim()
      .slice(0, REQUEST_COORDINATION_MAX_LENGTH);
    const duplicate = store.requests.find(
      (request) =>
        request.bookId === selectedBook.id &&
        request.buyerId === currentUser.id &&
        ["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status),
    );
    if (supabase) {
      let existingMessage = duplicate?.message;
      let existingMeetupLocation = duplicate?.preferredMeetupLocation;
      let existingMeetupTime = duplicate?.preferredMeetupTime;
      if (!duplicate) {
        const { data: existing, error: existingError } = await supabase
          .from("purchase_requests")
          .select("id,message,status,preferred_meetup_location,preferred_meetup_time")
          .eq("book_id", selectedBook.id)
          .eq("buyer_id", currentUser.id)
          .in("status", ["pending", "waitlisted", "reserved", "awaiting_confirmation"])
          .order("created_at", { ascending: false })
          .limit(1)
          .abortSignal(AbortSignal.timeout(10_000))
          .maybeSingle();
        if (existingError) {
          setToast(`無法確認既有購買意願：${existingError.message}`);
          return;
        }
        existingMessage = existing ? String(existing.message || "") : undefined;
        existingMeetupLocation = existing ? String(existing.preferred_meetup_location || "") : undefined;
        existingMeetupTime = existing ? String(existing.preferred_meetup_time || "") : undefined;
      }
      if (
        existingMessage?.trim() === message
        && String(existingMeetupLocation || "").trim() === preferredMeetupLocation
        && String(existingMeetupTime || "").trim() === preferredMeetupTime
      ) {
        setModal(null);
        setEditingRequest(null);
        setToast("已送出購買意願");
        return;
      }
      const { error } = await supabase.rpc("create_purchase_request", {
        target_book_id: selectedBook.id,
        request_message: message,
        preferred_meetup_location: preferredMeetupLocation,
        preferred_meetup_time: preferredMeetupTime,
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
      if (
        duplicate.message.trim() === message
        && duplicate.preferredMeetupLocation.trim() === preferredMeetupLocation
        && duplicate.preferredMeetupTime.trim() === preferredMeetupTime
      ) {
        setModal(null);
        setEditingRequest(null);
        setToast("已送出購買意願");
        return;
      }
      setStore((previous) => ({
        ...previous,
        requests: previous.requests.map((request) =>
          request.id === duplicate.id
            ? {
              ...request,
              message,
              preferredMeetupLocation,
              preferredMeetupTime,
              updatedAt: new Date().toISOString(),
            }
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
          preferredMeetupLocation,
          preferredMeetupTime,
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
    } catch (error) {
      setToast(error instanceof Error ? error.message : "購買意願送出失敗，請稍後再試");
    } finally {
      requestSavingRef.current = false;
      setRequestSaving(false);
    }
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
    const targetRequest = store.requests.find((request) => request.id === requestId);
    const targetBook = targetRequest
      ? [...myBooks, ...requestBooks, ...marketplaceBooks, ...store.books].find((book) => book.id === targetRequest.bookId)
      : null;
    const sellerCancellingReservation = Boolean(
      targetRequest
      && targetBook?.sellerId === currentUser.id
      && ["reserved", "awaiting_confirmation"].includes(targetRequest.status),
    );
    const reason = await actionDialog.ask({
      title: sellerCancellingReservation ? "取消保留" : "取消購買意願",
      message: sellerCancellingReservation
        ? "取消保留後課本會恢復可購買狀態，候補買家會回到等待處理；聊天室與交易紀錄仍會保留供雙方查閱。"
        : "取消後這筆交易會結束，聊天室與交易紀錄仍會依平台政策保留供雙方查閱。",
      inputLabel: "取消原因",
      inputPlaceholder: "請至少輸入 2 個字",
      minLength: 2,
      confirmLabel: sellerCancellingReservation ? "確認取消保留" : "確認取消",
      danger: true,
    });
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
      setToast(sellerCancellingReservation ? "保留已取消" : "購買意願已取消");
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
    openDashboardTab("chats");
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
    openDashboardTab("chats");
    void openConversation(String(data));
  }

  function restorePageScroll(position: { x: number; y: number }) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: position.y, left: position.x, behavior: "auto" });
      window.requestAnimationFrame(() => window.scrollTo({ top: position.y, left: position.x, behavior: "auto" }));
      window.setTimeout(() => window.scrollTo({ top: position.y, left: position.x, behavior: "auto" }), 120);
    });
  }

  async function openConversation(conversationId: string, options: { preservePageScroll?: boolean } = {}) {
    const preserveScroll = typeof window !== "undefined" && options.preservePageScroll
      ? { x: window.scrollX, y: window.scrollY }
      : null;
    setExpandedConversationId(conversationId);
    if (preserveScroll) {
      restorePageScroll(preserveScroll);
    }
    if (currentUser) {
      window.localStorage.setItem(lastChatStorageKey(currentUser.id), conversationId);
    }
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

  async function openTradeReview(request: PurchaseRequest) {
    if (!supabase || !currentUser || request.status !== "completed") return;
    try {
      const status = await fetchMyReviewStatus(supabase, request.id);
      if (!status || status.reviewed) {
        setToast("這筆交易已完成評價");
        return;
      }
      setReviewRequest(request);
      setReviewStatus(status);
      setModal("tradeReview");
    } catch (error) {
      setToast(`無法載入評價狀態：${error instanceof Error ? error.message : "請稍後再試"}`);
    }
  }

  async function handleTradeReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !reviewRequest) return;
    const form = new FormData(event.currentTarget);
    const rating = Number(form.get("rating") || 0);
    const tags = form.getAll("tags").map(String) as TradeReviewTag[];
    const comment = String(form.get("comment") || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setToast("請選擇 1 到 5 顆星");
      return;
    }
    try {
      await submitTradeReview(supabase, reviewRequest.id, rating, tags, comment);
      setModal(null);
      setReviewRequest(null);
      setReviewStatus(null);
      await reloadAfterUserMutation();
      setToast("評價已送出，謝謝你的回饋");
    } catch (error) {
      setToast(`評價送出失敗：${error instanceof Error ? error.message : "請稍後再試"}`);
    }
  }

  async function deleteBook(bookId: string) {
    if (currentUser?.accountStatus === "suspended") {
      setToast("你的帳號目前為唯讀模式，不能修改刊登");
      return;
    }
    const confirmed = await actionDialog.ask({
      title: "下架刊登",
      message: "下架後不會再公開顯示；既有交易與聊天室不會被刪除。若目前沒有進行中的交易，之後可從刊登管理恢復。",
      confirmLabel: "確認下架",
      danger: true,
    });
    if (confirmed === null) return;
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
      ? (await actionDialog.ask({
          title: "拒絕刊登",
          message: "刊登不會公開，賣家會看到下方原因並可修改後重新送審。",
          inputLabel: "拒絕原因",
          minLength: 2,
          confirmLabel: "拒絕刊登",
          danger: true,
        }))?.trim()
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

  async function reviewStudentVerification(verificationId: string, decision: "approved" | "rejected") {
    if (!supabase || !currentUser) return;
    const dialogResult = await actionDialog.ask({
      title: decision === "rejected" ? "拒絕學生證驗證" : "通過學生證驗證",
      message: decision === "rejected"
        ? "驗證會被拒絕，使用者可看到原因並重新送審；原始圖片與 OCR 文字會立即刪除。"
        : "通過後會更新驗證狀態，原始圖片與 OCR 文字會立即刪除。",
      inputLabel: decision === "rejected" ? "拒絕原因" : "審核備註（選填）",
      minLength: decision === "rejected" ? 2 : 0,
      confirmLabel: decision === "rejected" ? "確認拒絕" : "確認通過",
      danger: decision === "rejected",
    });
    if (dialogResult === null) return;
    const note = dialogResult.trim();
    if (decision === "rejected" && !note) return;

    const pendingVerification = studentVerifications.find((item) => item.id === verificationId);
    if (!pendingVerification) {
      setToast("這筆學生證已被其他管理員處理，清單即將更新");
      refreshModerationInBackground();
      return;
    }
    setStudentVerifications((previous) => previous.filter((item) => item.id !== verificationId));
    setToast("正在送出審核結果…");

    try {
      await reviewStudentVerificationWithStorage(supabase, verificationId, decision, note || "");
    } catch (error) {
      setStudentVerifications((previous) => previous.some((item) => item.id === verificationId)
        ? previous
        : [...previous, pendingVerification].sort((left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
          ));
      const message = error instanceof Error ? error.message : "學生證審核失敗";
      setToast(`學生證審核失敗：${message}`);
      return;
    }
    refreshModerationInBackground();
    setToast(decision === "approved" ? "學生證已通過" : "學生證已拒絕");
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

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUser) return;
    const data = new FormData(event.currentTarget);
    const message = String(data.get("message") || "").trim();
    if (message.length < 10) {
      setToast("請至少輸入 10 個字，讓我們能了解你遇到的問題");
      return;
    }
    const { error } = await supabase.rpc("submit_feedback", {
      feedback_category: String(data.get("category") || "other"),
      feedback_message: message,
    });
    if (error) {
      setToast(`送出問題回報失敗：${error.message}`);
      return;
    }
    setModal(null);
    setToast("問題回報已送出，我們會盡快查看");
  }

  async function resolveFeedback(feedbackId: string) {
    if (!supabase || !currentUser) return;
    const note = await actionDialog.ask({
      title: "完成問題回報",
      message: "這會將回報標記為已處理；備註會保留給後台稽核。",
      inputLabel: "處理備註（選填）",
      confirmLabel: "標記完成",
    });
    if (note === null) return;
    const { error } = await supabase.rpc("resolve_feedback", {
      target_feedback_id: feedbackId,
      note: note.trim(),
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`處理問題回報失敗：${error.message}`);
      return;
    }
    await reloadAfterModerationMutation();
    setToast("問題回報已標記為完成");
  }

  async function hideClosedConversation(conversationId: string) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.rpc("hide_closed_conversation", {
      target_conversation_id: conversationId,
    });
    if (error) {
      setToast(`無法刪除聊聊：${error.message}`);
      return;
    }
    setExpandedConversationId(null);
    setConversations((previous) => previous.filter((conversation) => conversation.id !== conversationId));
    setToast("聊聊已從你的清單刪除");
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

  async function reviewTrustBadge(userId: string, badgeType: "seller" | "buyer", decision: "approve" | "reject" | "revoke") {
    if (!supabase || !currentUser) return;
    const note = await actionDialog.ask({
      title: decision === "approve" ? "核准信任徽章" : "撤下信任徽章",
      message: "請留下本次人工審核備註，供管理員追蹤。",
      inputLabel: "審核備註",
      confirmLabel: decision === "approve" ? "核准公開" : "確認撤下",
      danger: decision !== "approve",
    });
    if (note === null) return;
    const { error } = await supabase.rpc("review_trust_badge", {
      target_user_id: userId,
      target_badge_type: badgeType,
      decision,
      note: note.trim(),
    });
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`徽章審核失敗：${error.message}`);
      return;
    }
    await loadModerationPanel(currentUser);
    await loadRiskModeration(currentUser, appliedRiskFilters);
    setToast(decision === "approve" ? "徽章已核准公開" : "徽章已撤下");
  }

  function updateRiskFilter<K extends keyof RiskModerationFilters>(key: K, value: RiskModerationFilters[K]) {
    setRiskFilters((previous) => ({ ...previous, [key]: value, offset: 0 }));
  }

  function changeRiskPage(direction: -1 | 1) {
    setRiskFilters((previous) => ({
      ...previous,
      offset: Math.max(0, previous.offset + direction * RISK_REVIEW_PAGE_SIZE),
    }));
  }

  async function openRiskProfile(userId: string) {
    if (!supabase || !currentUser) return;
    setSelectedRiskProfileId(userId);
    setRiskProfileDetail(null);
    setRiskProfileDetailLoading(true);
    try {
      const detail = await fetchRiskProfileDetail(supabase, userId);
      if (!detail) {
        setToast("找不到這筆風險資料");
        return;
      }
      setRiskProfileDetail(detail);
      if (detail.reviewStatus === "pending") {
        await updateRiskReviewStatus(supabase, userId, "viewed");
        setRiskProfileDetail((previous) => previous ? { ...previous, reviewStatus: "viewed", reviewUpdatedAt: new Date().toISOString() } : previous);
        await loadRiskModeration(currentUser, appliedRiskFilters);
      }
    } catch (error) {
      if (await recoverAdminVerification(error instanceof Error ? error.message : "", currentUser)) return;
      setToast(`讀取風險詳情失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setRiskProfileDetailLoading(false);
    }
  }

  async function changeRiskReviewStatus(status: RiskReviewStatus) {
    if (!supabase || !currentUser || !riskProfileDetail) return;
    try {
      await updateRiskReviewStatus(supabase, riskProfileDetail.userId, status);
      setRiskProfileDetail((previous) => previous ? { ...previous, reviewStatus: status, reviewUpdatedAt: new Date().toISOString() } : previous);
      await loadRiskModeration(currentUser, appliedRiskFilters);
      setToast(status === "processed" ? "風險項目已標記為已處理" : status === "pending" ? "風險項目已重新開啟" : "風險項目已標記為已查看");
    } catch (error) {
      if (await recoverAdminVerification(error instanceof Error ? error.message : "", currentUser)) return;
      setToast(`更新風險狀態失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    }
  }

  async function saveRiskPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !currentUser || currentUser.role !== "admin" || !riskPolicy) return;
    const form = new FormData(event.currentTarget);
    const number = (name: string, fallback: number) => Number(form.get(name) || fallback);
    const values = {
      new_min_completed_trades: number("minCompletedTrades", riskPolicy.minCompletedTrades),
      new_good_badge_min_average: number("goodBadgeMinAverage", riskPolicy.goodBadgeMinAverage),
      new_good_badge_max_serious_reports: number("goodBadgeMaxSeriousReports", riskPolicy.goodBadgeMaxSeriousReports),
      new_medium_risk_score: number("mediumRiskScore", riskPolicy.mediumRiskScore),
      new_high_risk_score: number("highRiskScore", riskPolicy.highRiskScore),
      new_one_star_penalty: riskPolicy.oneStarPenalty,
      new_two_star_penalty: riskPolicy.twoStarPenalty,
      new_three_star_penalty: riskPolicy.threeStarPenalty,
      new_fraud_report_weight: riskPolicy.fraudReportWeight,
      new_harassment_report_weight: riskPolicy.harassmentReportWeight,
      new_no_show_report_weight: riskPolicy.noShowReportWeight,
      new_misleading_report_weight: riskPolicy.misleadingReportWeight,
      new_duplicate_report_weight: riskPolicy.duplicateReportWeight,
      new_other_report_weight: riskPolicy.otherReportWeight,
    };
    const { error } = await supabase.rpc("update_risk_policy", values);
    if (error) {
      if (await recoverAdminVerification(error.message, currentUser)) return;
      setToast(`風險門檻更新失敗：${error.message}`);
      return;
    }
    await loadModerationPanel(currentUser);
    await loadRiskModeration(currentUser, appliedRiskFilters);
    setToast("風險門檻已更新");
  }

  async function resolveReport(reportId: string, action: "dismiss" | "resolve" | "hide_book" | "suspend_user") {
    if (!supabase || !currentUser) return;
    const requiresReason = action === "hide_book" || action === "suspend_user";
    const note = await actionDialog.ask({
      title: action === "dismiss" ? "駁回檢舉" : "處理檢舉",
      message: requiresReason
        ? "此操作會影響商品顯示或會員權限，原因會顯示給受處分會員並保留稽核紀錄。"
        : "檢舉狀態會更新並保留處理紀錄。",
      inputLabel: requiresReason ? "處理原因" : "處理備註（選填）",
      minLength: requiresReason ? 2 : 0,
      confirmLabel: action === "dismiss" ? "確認駁回" : "確認處理",
      danger: requiresReason,
    });
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
    const dialogResult = await actionDialog.ask({
      title: status === "suspended" ? "停權會員" : "解除停權",
      message: status === "suspended"
        ? "會員仍可登入查看既有交易，但不能刊登、下訂或傳送新訊息。原因會顯示給會員並保留稽核紀錄。"
        : "解除後會員可恢復刊登、下訂與聊天等功能。",
      inputLabel: status === "suspended" ? "停權原因" : undefined,
      minLength: status === "suspended" ? 2 : 0,
      confirmLabel: status === "suspended" ? "確認停權" : "確認解除",
      danger: status === "suspended",
    });
    if (dialogResult === null) return;
    const reason = dialogResult.trim();
    if (status === "suspended" && !reason) return;
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
      openDashboardTab("received");
      return;
    }
    if (notification.type === "request_accepted" || notification.type === "request_rejected") {
      openDashboardTab("requests");
      return;
    }
    if (notification.type === "handoff_confirmation") {
      openDashboardTab("requests");
      return;
    }
    if (notification.type === "book_approved" || notification.type === "book_rejected" || notification.type === "book_hidden") {
      openDashboardTab("listings");
      return;
    }
    if (notification.type === "listing_lifecycle") {
      openDashboardTab("listings");
      return;
    }
    if (notification.type === "trade_completed") {
      openDashboardTab("listings");
      return;
    }
    if (notification.type === "trade_message") {
      openDashboardTab("chats");
      if (notification.conversationId) void openConversation(notification.conversationId);
      return;
    }
    if (notification.bookId) {
      openBookRoute(notification.bookId, listingType);
      return;
    }
    showDashboard();
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
  const favoriteBooks = uniqueFavoriteBooks(knownBooks, favoriteIds);
  const myRequests = currentUser ? store.requests.filter((request) => request.buyerId === currentUser.id) : [];
  const activeMyRequestCount = myRequests.filter((request) => request.status !== "expired").length;
  const receivedRequests = currentUser
    ? store.requests.filter((request) =>
        (supabase ? myBooks : store.books).some((book) => book.id === request.bookId && book.sellerId === currentUser.id),
      )
    : [];
  const activeReceivedRequestCount = receivedRequests.filter((request) => request.status !== "expired").length;
  const isModerator = currentUser?.accountStatus === "active"
    && (currentUser.role === "admin" || currentUser.role === "moderator");
  const pendingReports = reports.filter((report) => report.status === "pending");
  const pendingFeedback = feedback.filter((item) => item.status === "pending");
  const adminPendingCount = pendingReports.length + pendingReviews.length + pendingFeedback.length + studentVerifications.length;
  const adminWorkspaceItems: Array<{ id: AdminWorkspace; label: string; description: string; count?: number }> = [
    { id: "overview", label: "後台總覽", description: "今天需要注意的工作" },
    { id: "listings", label: "刊登審核", description: "處理待上架商品", count: pendingReviews.length },
    { id: "reports", label: "檢舉處理", description: "查看使用者回報", count: pendingReports.length },
    { id: "feedback", label: "網站回饋", description: "整理產品意見", count: pendingFeedback.length },
    { id: "studentVerification", label: "學生證審核", description: "確認學籍資料", count: studentVerifications.length },
    { id: "risk", label: "交易風險", description: "優先處理高／中風險", count: riskSummary?.queueCount ?? 0 },
    { id: "hiddenListings", label: "已隱藏商品", description: "檢視與恢復內容", count: hiddenBooks.length },
    ...(currentUser?.role === "admin" ? [{ id: "permissions" as const, label: "權限管理", description: "角色與帳號狀態" }] : []),
  ];

  function openAdminWorkspace(workspace: AdminWorkspace) {
    setAdminWorkspace(workspace);
    setView("admin");
    setMobileMenuOpen(false);
  }
  const unreadNotifications = unreadNotificationCount;
  const activeAvailableListings = myListings.filter((book) => book.lifecycleState === "active" && book.status === "available");
  const archivedListings = myListings.filter((book) => book.lifecycleState === "archived");
  const nextConfirmationAt = sellerLifecycle
    ? new Date(new Date(sellerLifecycle.listingsConfirmedAt).getTime() + 30 * 86400000).toISOString()
    : null;
  const confirmationDue = Boolean(nextConfirmationAt && new Date(nextConfirmationAt).getTime() <= Date.now());
  const isSecondhandMode = listingType === "secondhand";
  const activeMarketLabel = isSecondhandMode ? "二手物品" : "二手書籍";
  const hasMarketplaceFilters = Boolean(
    query.trim()
    || minPrice !== NO_MIN_PRICE
    || maxPrice !== NO_MAX_PRICE
    || (isSecondhandMode ? itemCategory !== ALL_ITEM_CATEGORIES : !isAllDepartments(department)),
  );

  function clearMarketplaceFilters() {
    setQuery("");
    setMinPrice(NO_MIN_PRICE);
    setMaxPrice(NO_MAX_PRICE);
    setDepartment(departments[0]);
    setItemCategory(ALL_ITEM_CATEGORIES);
    setImageSearchQuery("");
    setImageSearchActive(false);
    setImageSearchResultCount(null);
    setImageSearchMessage("");
    setImageSearchProgress(0);
  }

  function openCourseSearchGuide() {
    setShowCourseSearchGuide(true);
    setImageSearchActive(false);
    setImageSearchResultCount(null);
    document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("home-filter-query")?.focus(), 350);
  }

  function openImageSearchPicker() {
    imageSearchInputRef.current?.click();
  }

  async function runImageSearch(file: File) {
    const fileError = validateImageSearchFile(file);
    if (fileError) {
      setImageSearchMessage(fileError);
      setImageSearchProgress(0);
      return;
    }

    const requestId = ++imageSearchRequestRef.current;
    const previousPreview = imageSearchPreview;
    const nextPreview = URL.createObjectURL(file);
    setImageSearchPreview(nextPreview);
    if (previousPreview.startsWith("blob:")) URL.revokeObjectURL(previousPreview);
    setImageSearchBusy(true);
    setImageSearchProgress(4);
    setImageSearchActive(false);
    setImageSearchResultCount(null);
    setImageSearchMessage("正在讀取照片中的課本資訊...");
    setImageSearchQuery("");

    try {
      const { recognizeBookCover } = await import("@/lib/marketplace/free-ocr");
      const ocrFile = await compressBookOcrImage(file);
      const primaryResult = await recognizeBookCover(ocrFile, (stage, progress) => {
        if (requestId !== imageSearchRequestRef.current) return;
        const percent = Math.max(1, Math.round((progress ?? 0) * 100));
        if (stage === "preparing") {
          setImageSearchProgress(8);
          setImageSearchMessage("正在準備照片...");
        }
        if (stage === "english") {
          setImageSearchProgress(Math.min(55, 12 + Math.round(percent * 0.42)));
          setImageSearchMessage("正在找出可能的書名...");
        }
        if (stage === "chinese") {
          setImageSearchProgress(Math.min(84, 55 + Math.round(percent * 0.28)));
          setImageSearchMessage("正在找出可能的書名...");
        }
      });
      if (requestId !== imageSearchRequestRef.current) return;

      const localPlan = buildImageSearchPlan(primaryResult.draft);
      const needsAiFallback = !localPlan.displayQuery || primaryResult.needsAiFallback;
      let finalPlan = needsAiFallback ? null : localPlan;
      let aiFallbackError = "";

      if (needsAiFallback && supabase && currentUser) {
        setImageSearchProgress(88);
        setImageSearchMessage("正在提高辨識準確度...");
        try {
          const { recognizeBookCoverWithAi } = await import("@/lib/marketplace/book-ocr-ai");
          const aiResult = await recognizeBookCoverWithAi(supabase, ocrFile, primaryResult.text);
          if (requestId !== imageSearchRequestRef.current) return;
          const aiPlan = buildImageSearchPlan(aiResult.draft);
          if (aiPlan.displayQuery) {
            finalPlan = aiPlan;
          }
        } catch (error) {
          aiFallbackError = error instanceof Error ? error.message : "暫時無法提高辨識準確度";
        }
      }

      if (requestId !== imageSearchRequestRef.current) return;
      if (!finalPlan?.displayQuery || finalPlan.candidateQueries.length === 0) {
        setImageSearchProgress(0);
        setImageSearchMessage(
          needsAiFallback && !currentUser
            ? "這張照片暫時無法辨識。可以登入後再試一次，或改用文字搜尋。"
            : `這張照片暫時無法辨識。可以換一張更清楚的封面，或改用文字搜尋。${aiFallbackError ? ` ${aiFallbackError}` : ""}`,
        );
        return;
      }

      setImageSearchProgress(94);
      setImageSearchMessage("正在比對站內刊登...");
      setImageSearchActive(true);
      setListingType("book");
      setItemCategory(ALL_ITEM_CATEGORIES);
      setDepartment(departments[0]);
      setMinPrice(NO_MIN_PRICE);
      setMaxPrice(NO_MAX_PRICE);

      let rankedBooks: Book[] = [];
      if (supabase) {
        const ranked = await fetchImageSearchCandidates(supabase, {
          ...marketplaceFilters,
          listingType: "book",
          itemCategory: null,
          department: null,
          minPrice: null,
          maxPrice: null,
        }, finalPlan);
        if (requestId !== imageSearchRequestRef.current) return;
        rankedBooks = ranked.map((result) => result.book);
        setMarketplaceBooks(rankedBooks);
        setMarketplaceCount(rankedBooks.length);
        setMarketplaceHasMore(false);
        marketplaceCursorRef.current = null;
      } else {
        rankedBooks = rankImageSearchResults(
          store.books.filter((book) =>
            book.reviewStatus === "approved"
            && book.moderationVisibility === "visible"
            && book.lifecycleState === "active"
            && book.status !== "sold"
            && (book.listingType || "book") === "book",
          ),
          finalPlan,
        ).map((result) => result.book);
        setMarketplaceBooks(rankedBooks);
        setMarketplaceCount(rankedBooks.length);
        setMarketplaceHasMore(false);
        marketplaceCursorRef.current = null;
      }

      setImageSearchQuery(finalPlan.displayQuery);
      setImageSearchActive(true);
      setImageSearchResultCount(rankedBooks.length);
      setImageSearchProgress(100);
      setImageSearchMessage(
        `找到 ${rankedBooks.length} 筆相近結果，已依相似度排序。`,
      );
      document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (requestId !== imageSearchRequestRef.current) return;
      setImageSearchProgress(0);
      setImageSearchMessage(error instanceof Error ? error.message : "照片搜尋暫時無法使用，請稍後再試。");
    } finally {
      if (requestId === imageSearchRequestRef.current) setImageSearchBusy(false);
    }
  }

  function updateMarketplaceQuery(nextQuery: string) {
    setQuery(nextQuery);
    if (imageSearchActive || imageSearchQuery) {
      setImageSearchActive(false);
      setImageSearchResultCount(null);
      setImageSearchQuery("");
      setImageSearchProgress(0);
      setImageSearchMessage("已切換為一般文字搜尋，可修改字串或重新上傳照片。");
    }
  }

  function handleImageSearchFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void runImageSearch(file);
  }

  return (
    <main className={isSecondhandMode ? "theme-secondhand" : undefined}>
      <input
        ref={imageSearchInputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImageSearchFile}
        aria-label="上傳書封照片搜尋站內課本"
      />
      <header className="site-header">
        <button type="button" className="brand" onClick={() => { setView("home"); setMobileMenuOpen(false); }} aria-label="虎科書流首頁">
          <span className="brand-mark"><BookOpen size={23} /></span>
          <span><b>虎科書流</b><small>HUST BOOKFLOW</small></span>
        </button>
        <nav>
          <div className="market-switch" role="group" aria-label="選擇市場">
            <button type="button" className={!isSecondhandMode ? "active" : ""} aria-pressed={!isSecondhandMode} onClick={() => { switchListingType("book"); setView("home"); }}><BookOpen size={16} aria-hidden="true" />二手書籍</button>
            <button type="button" className={isSecondhandMode ? "active" : ""} aria-pressed={isSecondhandMode} onClick={() => { switchListingType("secondhand"); setView("home"); }}><Sparkles size={16} aria-hidden="true" />二手物品</button>
          </div>
          <button type="button" className={view === "home" ? "active" : ""} onClick={() => setView("home")}>{isSecondhandMode ? "找二手物品" : "找二手書籍"}</button>
          <button type="button" onClick={() => requireActive(() => openListingForm(listingType))}>我要刊登</button>
          <button type="button" onClick={() => requireLogin(openDashboard)}>我的交易</button>
          {isModerator && <button type="button" className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>管理</button>}
        </nav>
        <div className="header-actions">
          {currentUser ? (
            <>
              {isModerator && <button type="button" className="icon-button admin-shortcut" title="管理" onClick={() => setView("admin")}><UserCog size={18} /></button>}
              <div className="notification-wrap">
                <button type="button"
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
                      {unreadNotifications > 0 && <button type="button" onClick={() => void markAllNotificationsRead()}><CheckCheck size={15} />全部已讀</button>}
                    </div>
                    <div className="push-setting">
                      <div>
                        <b>瀏覽器推播</b>
                        <small>
                          {pushState === "enabled" && "已開啟交易與刊登更新通知。"}
                          {pushState === "disabled" && "開啟後可收到新的交易活動。"}
                          {pushState === "denied" && "瀏覽器目前封鎖通知權限。"}
                          {pushState === "unsupported" && "此瀏覽器不支援推播。"}
                        </small>
                      </div>
                      {pushState === "enabled" ? (
                        <button type="button" disabled={pushSaving} onClick={() => void disablePushNotifications()}>關閉</button>
                      ) : (
                        <button type="button"
                          disabled={pushSaving || pushState === "denied" || pushState === "unsupported"}
                          onClick={() => void enablePushNotifications()}
                        >
                          開啟
                        </button>
                      )}
                    </div>
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <button type="button"
                          className={"notification-item " + (notification.readAt ? "" : "unread")}
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
              <button type="button" className="user-chip desktop-account-action" onClick={openDashboard}><UserRound size={17} />{currentUser.name}</button>
              <button type="button" className="icon-button desktop-account-action" title="登出" onClick={() => void logout()}><LogOut size={18} /></button>
            </>
          ) : (
            <button type="button" className="login-button desktop-account-action" onClick={() => setModal("login")}><UserRound size={17} /><span>登入／註冊</span></button>
          )}
          <button type="button"
            className={"mobile-menu " + (mobileMenuOpen ? "active" : "")}
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
          <div className="mobile-nav-backdrop">
            <button
              type="button"
              className="mobile-nav-dismiss"
              aria-label="關閉選單"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div id="mobile-navigation" className="mobile-nav">
              <button type="button"
                onClick={() => {
                  switchListingType(isSecondhandMode ? "book" : "secondhand");
                  setView("home");
                  setMobileMenuOpen(false);
                }}
              >
                {isSecondhandMode ? <BookOpen size={18} /> : <Sparkles size={18} />}
                {isSecondhandMode ? "回二手書籍市場" : "逛二手物品"}
              </button>
              <button type="button"
                className={view === "home" ? "active" : ""}
                onClick={() => {
                  setView("home");
                  setMobileMenuOpen(false);
                }}
              >
                {isSecondhandMode ? "逛二手物品" : "找二手書籍"}
              </button>
              <button type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  requireActive(() => openListingForm(listingType));
                }}
              >
                我要刊登
              </button>
              <button type="button"
                className={view === "dashboard" ? "active" : ""}
                onClick={() => {
                  setMobileMenuOpen(false);
                  requireLogin(openDashboard);
                }}
              >
                我的交易
              </button>
              {isModerator && (
                <button type="button"
                  className={view === "admin" ? "active" : ""}
                  onClick={() => { setView("admin"); setMobileMenuOpen(false); }}
                >
                  審核後台
                </button>
              )}
              <div className="mobile-nav-separator" />
              {currentUser ? (
                <>
                  <button type="button" onClick={() => { openDashboard(); setMobileMenuOpen(false); }}>
                    <UserRound size={18} />會員中心
                  </button>
                  <button type="button" onClick={() => void logout()}>
                    <LogOut size={18} />登出
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setModal("login"); setMobileMenuOpen(false); }}>
                  <UserRound size={18} />登入 / 註冊
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {!online && (
        <output className="offline-banner" aria-live="polite">
          目前為離線模式。你仍可查看已載入內容與草稿；刊登、交易、聊天與辨識會在恢復網路後才能送出。
        </output>
      )}

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
            <section className="suspension-banner" aria-live="polite">
              <Ban size={18} aria-hidden="true" />
              <div><b>帳號目前為唯讀模式</b><span>{currentUser.suspensionReason || "請聯絡管理員了解停權原因。"}</span></div>
            </section>
          )}
          <section className="hero" aria-labelledby="home-hero-title">
            <div className="hero-art hero-reference-art" aria-hidden="true" />
            <div className="hero-copy hero-search-panel">
              <div className="hero-message">
                <h1 id="home-hero-title">{isSecondhandMode ? <>Good Finds,<br />Next Chapter.</> : <>Used Books,<br />New Chapter.</>}</h1>
                <p>{isSecondhandMode ? "在虎科找到適合你的二手物品，也讓閒置好物繼續被需要。" : "在虎科找到需要的二手書，也讓讀過的故事繼續流動。"}</p>
              </div>
              <form
                className="hero-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  document.getElementById("market")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <label htmlFor="hero-search-input">
                  <Search size={22} aria-hidden="true" />
                  <input
                    id="hero-search-input"
                    value={query}
                    onChange={(event) => updateMarketplaceQuery(event.target.value)}
                    placeholder={isSecondhandMode ? "搜尋物品名稱、類別或描述..." : "搜尋二手書名、課程或老師..."}
                  />
                  <button
                    type="submit"
                    className="hero-search-arrow"
                    aria-label={isSecondhandMode ? "依目前輸入開始找二手物品" : "依目前輸入開始找二手書籍"}
                  >
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </label>
                {!isSecondhandMode && (
                  <button
                    type="button"
                    className="image-search-trigger"
                    disabled={imageSearchBusy}
                    aria-busy={imageSearchBusy}
                    onClick={openImageSearchPicker}
                  >
                    <ImagePlus size={18} aria-hidden="true" />
                    {imageSearchBusy ? "辨識中" : "用照片找二手書"}
                  </button>
                )}
                <button type="submit">{isSecondhandMode ? "開始找二手物品" : "開始找二手書"}</button>
              </form>
              <div className="hero-trust hero-assurance" aria-label="平台特色">
                <span><ShieldCheck size={17} aria-hidden="true" />校園面交更安心</span>
                <span><MessageCircle size={17} aria-hidden="true" />接受後依賣家設定分享聯絡方式</span>
                {isSecondhandMode ? <span><Sparkles size={17} aria-hidden="true" />探索校園二手好物</span> : <button type="button" onClick={openCourseSearchGuide}><GraduationCap size={17} aria-hidden="true" />依課程快速找到二手書</button>}
              </div>
            </div>
          </section>

          <section className="market" id="market" aria-labelledby="home-market-title">
            <div className="section-heading">
              <div><span className="section-kicker">LATEST LISTINGS</span><h2 id="home-market-title">最近上架的{activeMarketLabel}</h2></div>
              <button
                type="button"
                className="sell-cta"
                disabled={currentUser?.accountStatus === "suspended"}
                aria-disabled={currentUser?.accountStatus === "suspended"}
                onClick={() => requireActive(() => openListingForm(isSecondhandMode ? "secondhand" : "book"))}
              >
                <Plus size={18} aria-hidden="true" />{isSecondhandMode ? "刊登二手物品" : "刊登一本書"}
              </button>
            </div>
            <form className="filters" aria-label={isSecondhandMode ? "篩選二手物品" : "篩選課本"} onSubmit={(event) => event.preventDefault()}>
              {showCourseSearchGuide && !isSecondhandMode && (
                <div className="course-search-guide" role="status">
                  <GraduationCap size={17} aria-hidden="true" />
                  <span>在這裡輸入課堂名稱、老師或書名；也可以先選科系，再縮小課本範圍。</span>
                  <button type="button" aria-label="關閉課堂搜尋提示" onClick={() => setShowCourseSearchGuide(false)}><X size={14} /></button>
                </div>
              )}
              <label className="filter-search" htmlFor="home-filter-query">
                <span className="visually-hidden">搜尋</span>
                <Search size={20} aria-hidden="true" />
                <input
                  id="home-filter-query"
                  value={query}
                  onChange={(event) => updateMarketplaceQuery(event.target.value)}
                  placeholder={isSecondhandMode ? "搜尋二手物品..." : "搜尋課本..."}
                  aria-label={isSecondhandMode ? "搜尋二手物品" : "搜尋課本"}
                />
              </label>
              {!isSecondhandMode && (
                <button
                  type="button"
                  className="image-search-filter-button"
                  disabled={imageSearchBusy}
                  aria-busy={imageSearchBusy}
                  onClick={openImageSearchPicker}
                >
                  <ImagePlus size={17} aria-hidden="true" />
                  {imageSearchBusy ? "辨識中" : "照片搜二手書"}
                </button>
              )}
              {listingType === "book" ? (
                <label className="select-filter" htmlFor="home-filter-department">
                  <span className="visually-hidden">科系</span>
                  <select
                    id="home-filter-department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    aria-label="科系"
                  >
                    {departments.map((item, index) => <option key={item} value={item}>{index === 0 ? "全部科系" : item}</option>)}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </label>
              ) : (
                <label className="select-filter" htmlFor="home-filter-category">
                  <span className="visually-hidden">分類</span>
                  <select
                    id="home-filter-category"
                    value={itemCategory}
                    onChange={(event) => setItemCategory(event.target.value)}
                    aria-label="分類"
                  >
                    {SECONDHAND_CATEGORIES.map((item, index) => <option key={item} value={item}>{index === 0 ? "全部分類" : item}</option>)}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </label>
              )}
              <label className="price-filter select-filter" htmlFor="home-filter-price">
                <span className="visually-hidden">最高價格</span>
                <select
                  id="home-filter-price"
                  value={minPrice === MIN_PRICE_500 ? MIN_PRICE_500 : maxPrice}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMinPrice(value === MIN_PRICE_500 ? MIN_PRICE_500 : NO_MIN_PRICE);
                    setMaxPrice(value === MIN_PRICE_500 ? NO_MAX_PRICE : value);
                  }}
                  aria-label="最高價格"
                >
                  <option value="">不限價格</option>
                  <option value="300">NT$300 以下</option>
                  <option value="500">NT$500 以下</option>
                  <option value={MIN_PRICE_500}>NT$500 以上</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
            </form>
            {(imageSearchPreview || imageSearchMessage) && (
              <section className="image-search-status" aria-live="polite">
                {imageSearchPreview && (
                  <div className="image-search-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={safeImageSource(imageSearchPreview)} alt="用來搜尋站內課本的書封照片" />
                  </div>
                )}
                <div>
                  <b>站內以圖搜書</b>
                  <p>{imageSearchMessage || "正在準備站內搜尋..."}</p>
                  {imageSearchQuery && <small>照片辨識為：{imageSearchQuery}</small>}
                  {imageSearchActive && imageSearchResultCount !== null && (
                    <small>站內找到 {imageSearchResultCount} 筆相近結果；可改用一般文字搜尋。</small>
                  )}
                  {(imageSearchBusy || imageSearchProgress > 0) && (
                    <div className="image-search-progress">
                      <progress value={imageSearchProgress} max={100} aria-label="站內圖搜辨識進度" />
                      <span>{imageSearchBusy ? `${imageSearchProgress}%` : "完成"}</span>
                    </div>
                  )}
                  {imageSearchQuery && !marketplaceLoading && filteredBooks.length === 0 && (
                    <small>目前沒有找到站內相近課本，可以改短搜尋字串再試。</small>
                  )}
                </div>
              </section>
            )}
            <p className="result-line" aria-live="polite" aria-atomic="true">
              找到 <b>{supabase ? marketplaceCount : filteredBooks.length}</b> 筆{activeMarketLabel}
            </p>
            <ul className={`book-grid ${marketplaceLoading ? "is-refreshing" : ""}`} aria-label={`${activeMarketLabel}列表`} aria-busy={marketplaceLoading}>
              {filteredBooks.map((book) => (
                <li className={`book-card ${book.listingType === "secondhand" ? "secondhand-card" : ""}`} key={book.id}>
                  <button
                    type="button"
                    className="book-card-main"
                    onClick={() => openBook(book.id)}
                    aria-label={`查看《${book.title}》，${book.listingType === "secondhand" ? book.itemCategory : book.author}，${money(book.price)}，${book.condition}`}
                  >
                    <div className="card-image">
                      <Image src={book.imageUrl} alt="" width={420} height={560} sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 260px" />
                      {book.sellerVerified && <span className="verified-seller-badge"><ShieldCheck size={13} />已驗證賣家</span>}
                      <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                    </div>
                    <div className="card-body">
                      <span
                        className={`course-tag ${cardContextLabel(book) ? "" : "is-empty"}`}
                        aria-hidden={cardContextLabel(book) ? undefined : true}
                      >
                        {cardContextLabel(book) || "\u00a0"}
                      </span>
                      <h3>{book.title}</h3>
                      <p>{book.listingType === "secondhand" ? (book.description || "校園二手好物") : [book.author, book.edition, book.publisher].filter(Boolean).join(" · ")}</p>
                      {book.listingType === "book" && textbookMetadata(book).length > 0 && (
                        <small className="textbook-meta">{textbookMetadata(book).slice(0, 4).join(" · ")}</small>
                      )}
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
                </li>
              ))}
            </ul>
            {marketplaceLoading && filteredBooks.length > 0 && (
              <output className="market-refresh-note">正在更新搜尋結果...</output>
            )}
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
              <section className="empty" aria-live="polite">
                <BookOpen size={40} aria-hidden="true" />
                <h3>{hasMarketplaceFilters ? `找不到符合條件的${activeMarketLabel}` : `目前還沒有${activeMarketLabel}`}</h3>
                <p>{hasMarketplaceFilters ? "清除篩選後看看其他刊登。" : `成為第一位刊登${activeMarketLabel}的人，讓校園交換開始流動。`}</p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={hasMarketplaceFilters
                    ? clearMarketplaceFilters
                    : () => requireActive(() => openListingForm(isSecondhandMode ? "secondhand" : "book"))}
                >
                  {hasMarketplaceFilters ? "清除篩選" : `刊登${activeMarketLabel}`}
                </button>
              </section>
            )}
            {marketplaceLoading && filteredBooks.length === 0 && (
              <section className="empty" aria-live="polite" aria-busy="true">
                <BookOpen size={40} aria-hidden="true" />
                <h3>載入中...</h3>
              </section>
            )}
          </section>
        </div>
      )}

      {view === "book" && selectedBook && (
        <section className="detail-page">
          <button type="button" className="back-button" onClick={returnToMarket}><ArrowLeft size={18} />返回市場</button>
          <div className="detail-grid">
            <div className="detail-image">
              <Image src={selectedBook.imageUrl} alt={selectedBook.title} width={720} height={960} sizes="(max-width: 800px) 100vw, 42vw" priority />
              {selectedBook.lifecycleState === "active" && selectedBook.reviewStatus === "approved" && (
                <span className={`status ${selectedBook.status}`}>{statusLabels[selectedBook.status]}</span>
              )}
            </div>
            <div className="detail-content">
              {selectedBook.listingType === "secondhand" ? (
                <span className="course-tag">{selectedBook.itemCategory}</span>
              ) : (visibleBookField(selectedBook.department) || visibleBookField(selectedBook.course)) && (
                <span className="course-tag">{[visibleBookField(selectedBook.department), visibleBookField(selectedBook.course)].filter(Boolean).join(" · ")}</span>
              )}
              <h1>{selectedBook.title}</h1>
              {selectedBook.listingType === "book" && <p className="detail-author">{[selectedBook.author, selectedBook.edition, selectedBook.publisher].filter(Boolean).join(" · ")}</p>}
              {selectedBook.listingType === "book" && textbookMetadata(selectedBook).length > 0 && (
                <div className="textbook-meta-list" aria-label="課本資訊">
                  {textbookMetadata(selectedBook).map((item) => <span key={item}>{item}</span>)}
                </div>
              )}
              <strong className="detail-price">{money(selectedBook.price)}</strong>
              {currentUser?.id !== selectedBook.sellerId && (
                <button
                  type="button"
                  className={`detail-favorite-button ${favoriteIds.has(selectedBook.id) ? "active" : ""}`}
                  aria-pressed={favoriteIds.has(selectedBook.id)}
                  aria-label={favoriteIds.has(selectedBook.id) ? `取消收藏《${selectedBook.title}》` : `收藏《${selectedBook.title}》`}
                  onClick={(event) => toggleFavorite(selectedBook.id, event)}
                >
                  <Heart size={18} fill={favoriteIds.has(selectedBook.id) ? "currentColor" : "none"} aria-hidden="true" />
                  {favoriteIds.has(selectedBook.id) ? "已收藏" : "收藏"}
                </button>
              )}
              <div className="detail-facts">
                <div><small>{selectedBook.listingType === "secondhand" ? "物況" : "書況"}</small><b>{selectedBook.condition}</b></div>
                {selectedBook.listingType === "book" && visibleBookField(selectedBook.teacher) && <div><small>授課老師</small><b>{visibleBookField(selectedBook.teacher)}</b></div>}
                {selectedBook.listingType === "book" && selectedBook.isbn13 && <div><small>ISBN-13</small><b>{selectedBook.isbn13}</b></div>}
                {selectedBook.listingType === "book" && selectedBook.approvalNumber && <div><small>審定字號</small><b>{selectedBook.approvalNumber}</b></div>}
                {selectedBook.listingType === "secondhand" && <div><small>分類</small><b>{selectedBook.itemCategory}</b></div>}
                <div><small>面交地點</small><b>{selectedBook.meetup}</b></div>
              </div>
              <div className="description"><h3>賣家說明</h3><p>{selectedBook.description}</p></div>
              <div className="seller-row">
                <span className="avatar">{profile(selectedBook.sellerId)?.name.slice(0, 1) || "賣"}</span>
                <div><small>賣家</small><b>{profile(selectedBook.sellerId)?.name || "賣家"}</b><span>{profile(selectedBook.sellerId)?.department || ""}</span>
                  {selectedBook.sellerVerified && <em className="trust-badge"><ShieldCheck size={13} />已驗證學生賣家</em>}
                  {badgeFor(selectedBook.sellerId, "seller") && <em className="trust-badge"><ShieldCheck size={13} />優良賣家</em>}
                </div>
              </div>
              <div className="detail-action-row">
                {currentUser?.id === selectedBook.sellerId ? (
                  <button type="button" className="primary wide" disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(selectedBook); setModal("bookForm"); }}><Pencil size={18} />編輯我的刊登</button>
                ) : (
                  <div className="detail-primary-actions">
                    <button type="button"
                      className="chat-toggle wide"
                      disabled={selectedBook.status === "sold" || currentUser?.accountStatus === "suspended"}
                      onClick={() => requireActive(() => void startConversation(selectedBook.id))}
                    >
                      <MessageCircle size={18} />聊聊
                    </button>
                    <button type="button"
                      className="primary wide"
                      disabled={Boolean(selectedBookActiveRequest)
                        || (currentUser
                          && currentUser.id !== selectedBook.sellerId
                          && !["ready", "error"].includes(activeRequestCheckState))
                        || selectedBook.status !== "available"
                        || currentUser?.accountStatus === "suspended"}
                      onClick={() => {
                        if (selectedBookActiveRequest) return;
                        if (activeRequestCheckState === "error") {
                          activeRequestCheckStartedRef.current = null;
                          setActiveRequestCheckRetry((retry) => retry + 1);
                          setActiveRequestCheckState("idle");
                          return;
                        }
                        requireActive(() => setModal("request"));
                      }}
                    >
                      <Check size={18} />{selectedBookActiveRequest
                        ? `已下訂：${requestLabels[selectedBookActiveRequest.status]}`
                        : activeRequestCheckState === "loading"
                          ? "確認中..."
                          : activeRequestCheckState === "error"
                            ? "重試確認"
                            : selectedBook.status === "available" ? "確認下訂" : "已保留，暫停新訂單"}
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
      {view === "book" && !selectedBook && (
        <section className="detail-page">
          <button type="button" className="back-button" onClick={returnToMarket}><ArrowLeft size={18} />返回市場</button>
          <section className="empty" aria-live="polite">
            <BookOpen size={42} aria-hidden="true" />
            <h1>{bookDetailLoading ? "正在載入刊登..." : "找不到這筆刊登"}</h1>
            {!bookDetailLoading && bookDetailMissing && (
              <p>這筆刊登可能已下架、尚未通過審核，或連結已失效。</p>
            )}
          </section>
        </section>
      )}

      {view === "dashboard" && currentUser && (
        <section className="dashboard">
          <div className="dashboard-head">
            <div><span className="section-kicker">MY HUST BOOKFLOW</span><h1>嗨，{currentUser.name}</h1><p>管理你的刊登與購買意願。</p></div>
            <div className="dashboard-head-actions">
              <button type="button" className="secondary-action" disabled={currentUser.accountStatus === "suspended"} onClick={() => requireActive(() => setModal("profile"))}><UserRound size={18} />個人資料</button>
              <button type="button" className="primary" disabled={currentUser.accountStatus === "suspended"} onClick={() => requireActive(() => openListingForm(listingType))}><Plus size={18} />{isSecondhandMode ? "刊登二手物品" : "刊登課本"}</button>
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
              <button type="button" className="primary" disabled={lifecycleSaving} onClick={() => void confirmAllListings()}>
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
                <button type="button"
                  disabled={selectedArchivedIds.size === 0 || lifecycleSaving}
                  onClick={() => void reviewArchivedListings("keep")}
                >
                  <RotateCcw size={16} />恢復勾選項目
                </button>
                <button type="button"
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
            <button type="button" className={dashboardTab === "studentVerification" ? "active" : ""} onClick={() => setDashboardTab("studentVerification")}>學生身分驗證</button>
            <button type="button" className={dashboardTab === "listings" ? "active" : ""} onClick={() => setDashboardTab("listings")}>我的刊登 <span>{myListings.length}</span></button>
            <button type="button" className={dashboardTab === "chats" ? "active" : ""} onClick={() => setDashboardTab("chats")}>
              聊聊 <span>{conversations.reduce((sum, item) => sum + item.unreadCount, 0)}</span>
            </button>
            <button type="button" className={dashboardTab === "requests" ? "active" : ""} onClick={() => setDashboardTab("requests")}>我送出的意願 {activeMyRequestCount > 0 && <span>{activeMyRequestCount}</span>}</button>
            <button type="button" className={dashboardTab === "received" ? "active" : ""} onClick={() => setDashboardTab("received")}>收到的意願 {activeReceivedRequestCount > 0 && <span>{activeReceivedRequestCount}</span>}</button>
            <button type="button" className={dashboardTab === "favorites" ? "active" : ""} onClick={() => setDashboardTab("favorites")}>我的收藏 <span>{favoriteBooks.length}</span></button>
          </div>

          {dashboardTab === "studentVerification" && (
            <StudentVerificationPanel
              status={myStudentVerification}
              onSubmit={submitStudentVerification}
            />
          )}

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
                    ? <Image src={book.imageUrl} alt="" width={160} height={210} sizes="80px" />
                    : <div className="listing-image-placeholder"><BookOpen size={24} /></div>}
                  <div className="listing-main">
                    <div className="listing-badges">
                      {book.lifecycleState === "active" && book.reviewStatus === "approved" ? (
                        <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                      ) : book.lifecycleState !== "active" ? (
                        <span className={`lifecycle-badge ${book.lifecycleState}`}>
                          {book.lifecycleState === "archived" ? "暫時封存" : "已下架"}
                        </span>
                      ) : null}
                    </div>
                    <h3>{book.title}</h3>
                    <p>{visibleBookField(book.course) ? `${visibleBookField(book.course)} · ` : ""}{money(book.price)}</p>
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
                        <button type="button" disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(book); setModal("bookForm"); }}><Pencil size={16} />編輯</button>
                        <button type="button" disabled={currentUser.accountStatus === "suspended"} onClick={() => { setEditingBook(book); setModal("contactSettings"); }}><MessageCircle size={16} />聯絡方式</button>
                        <button type="button" disabled={currentUser.accountStatus === "suspended"} className="danger" onClick={() => void deleteBook(book.id)}><Trash2 size={16} />下架</button>
                      </>
                    )}
                    {book.lifecycleState === "withdrawn" && (
                      <button type="button" disabled={lifecycleSaving || currentUser.accountStatus === "suspended"} onClick={() => void restoreWithdrawnListing(book.id)}>
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
            <div className={`conversation-layout ${expandedConversationId ? "conversation-open" : ""}`}>
              <div className="conversation-list" id="conversation-list">
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
                      aria-current={expandedConversationId === conversation.id ? "true" : undefined}
                      onClick={() => void openConversation(conversation.id, { preservePageScroll: true })}
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
                  (() => {
                    const conversation = conversations.find((item) => item.id === expandedConversationId)!;
                    const book = knownBooks.find((item) => item.id === conversation.bookId) || null;
                    const conversationRequest = store.requests.find((request) =>
                      request.bookId === conversation.bookId
                      && request.buyerId === conversation.buyerId
                      && ["pending", "waitlisted", "reserved", "awaiting_confirmation", "completed"].includes(request.status)
                    ) || null;
                    return (
                      <TradeChatPanel
                        key={expandedConversationId}
                        conversation={conversation}
                        book={book}
                        request={conversationRequest}
                        currentUser={currentUser}
                        currentUserId={currentUser.id}
                        profiles={store.profiles}
                        onChanged={reloadAfterUserMutation}
                        onRead={keepConversationRead}
                        onBack={() => setExpandedConversationId(null)}
                        onHide={() => void hideClosedConversation(expandedConversationId)}
                        onOpenBook={openBook}
                        onEditRequest={() => {
                          if (!conversationRequest) return;
                          setEditingRequest(conversationRequest);
                          setSelectedId(conversation.bookId);
                          setDetailBook(null);
                          setModal("request");
                        }}
                        onRespondToRequest={respondToRequest}
                      />
                    );
                  })()
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
                      <RequestCoordinationPanel request={request} viewer="buyer" />
                      <OrderTimeline request={request} />
                    </div>
                    <div className="request-actions">
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button type="button" onClick={() => void cancelRequest(request.id)}><X size={16} />取消訂單</button>
                      )}
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button type="button" onClick={() => {
                          setEditingRequest(request);
                          setSelectedId(request.bookId);
                          setDetailBook(null);
                          setModal("request");
                        }}><Pencil size={16} />編輯</button>
                      )}
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation"].includes(request.status) && (
                        <button type="button" onClick={() => void openOrderConversation(request.id)}><MessageCircle size={16} />聊聊</button>
                      )}
                      {request.status === "awaiting_confirmation" && (
                        <button type="button" className="accept" onClick={() => void buyerConfirmTrade(request.id)}><CheckCheck size={16} />確認收到</button>
                      )}
                      {request.status === "completed" && (
                        <button type="button" className="review-action" onClick={() => void openTradeReview(request)}><ShieldCheck size={16} />評價交易</button>
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
                      {badgeFor(request.buyerId, "buyer") && <span className="trust-badge inline"><ShieldCheck size={13} />推薦買家</span>}
                      <h3>{buyer?.name} 想買《{book.title}》</h3>
                      {request.message && !HIDDEN_REQUEST_MESSAGES.has(request.message) && <p>「{request.message}」</p>}
                      {["reserved", "awaiting_confirmation"].includes(request.status) && <div className="contact-note">聯絡請使用獨立的「聊聊」頁籤。</div>}
                      <RequestCoordinationPanel request={request} viewer="seller" />
                      {sellerRequestNextStep(request) && <p className="order-next-step">{sellerRequestNextStep(request)}</p>}
                      <OrderTimeline request={request} />
                    </div>
                    <div className="request-actions">
                      {["pending", "waitlisted", "reserved", "awaiting_confirmation", "completed"].includes(request.status) && (
                        <button type="button" onClick={() => void openOrderConversation(request.id)}><MessageCircle size={16} />聊聊</button>
                      )}
                      {["pending", "waitlisted"].includes(request.status) && book.status === "available" && (
                        <button type="button" className="accept" onClick={() => void respondToRequest(request.id, "accepted")}><Check size={16} />選定買家</button>
                      )}
                      {["pending", "waitlisted"].includes(request.status) && (
                        <button type="button" onClick={() => void respondToRequest(request.id, "rejected")}><X size={16} />婉拒</button>
                      )}
                      {request.status === "reserved" && (
                        <>
                          <button type="button" className="accept" onClick={() => void sellerConfirmHandoff(request.id)}><CheckCheck size={16} />已完成面交</button>
                          <button type="button" onClick={() => void cancelRequest(request.id)}><X size={16} />取消保留</button>
                        </>
                      )}
                      {request.status === "completed" && (
                        <button type="button" className="review-action" onClick={() => void openTradeReview(request)}><ShieldCheck size={16} />評價交易</button>
                      )}
                    </div>
                    {buyer && request.status === "pending" && (
                      <button type="button"
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
                <article className={`book-card ${book.listingType === "secondhand" ? "secondhand-card" : ""}`} key={book.id}>
                  <button
                    type="button"
                    className="book-card-main"
                    onClick={() => openBook(book.id)}
                    aria-label={`查看《${book.title}》，${book.listingType === "secondhand" ? book.itemCategory : book.author}，${money(book.price)}，${book.condition}`}
                  >
                    <div className="card-image">
                      <Image src={book.imageUrl} alt={book.title} width={420} height={560} sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 260px" />
                      <span className={`status ${book.status}`}>{statusLabels[book.status]}</span>
                    </div>
                    <div className="card-body">
                      {cardContextLabel(book) && (
                        <span className="course-tag">{cardContextLabel(book)}</span>
                      )}
                      <h3>{book.title}</h3>
                      <p>{book.listingType === "secondhand" ? (book.description || "校園二手好物") : [book.author, book.edition, book.publisher].filter(Boolean).join(" · ")}</p>
                      {book.listingType === "book" && textbookMetadata(book).length > 0 && (
                        <small className="textbook-meta">{textbookMetadata(book).slice(0, 4).join(" · ")}</small>
                      )}
                      <div className="card-footer"><strong>{money(book.price)}</strong><small>{book.condition}</small></div>
                    </div>
                  </button>
                  <button type="button"
                    className="heart active"
                    aria-label="取消收藏"
                    aria-pressed="true"
                    onClick={(event) => toggleFavorite(book.id, event)}
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </article>
              ))}
              {favoriteBooks.length === 0 && <EmptyDashboard text="你還沒有收藏任何課本" />}
            </div>
          )}
        </section>
      )}

      {view === "admin" && currentUser && isModerator && (
        <section className="dashboard admin-page">
          <div className="dashboard-head admin-page-head">
            <div>
              <span className="section-kicker">MODERATION</span>
              <h1>管理工作台</h1>
              <p>處理檢舉、刊登審核、商品隱藏與會員權限。</p>
            </div>
            <div className="admin-head-status"><span className="admin-status-dot" />系統正常<span className="admin-count">{adminPendingCount} 筆待處理</span></div>
          </div>

          <div className="admin-workbench">
            <aside className="admin-sidebar" aria-label="管理工作區">
              <div className="admin-sidebar-heading"><span className="section-kicker">WORKSPACE</span><strong>管理導覽</strong></div>
              <nav>
                {adminWorkspaceItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={adminWorkspace === item.id ? "active" : ""}
                    aria-current={adminWorkspace === item.id ? "page" : undefined}
                    onClick={() => openAdminWorkspace(item.id)}
                  >
                    <span className="admin-nav-copy"><b>{item.label}</b><small>{item.description}</small></span>
                    {typeof item.count === "number" && <span className={`admin-nav-count ${item.count > 0 ? "has-items" : ""}`}>{item.count}</span>}
                  </button>
                ))}
              </nav>
              <div className="admin-sidebar-footer"><span className="admin-sidebar-avatar">{currentUser.name.slice(0, 1)}</span><span><b>{currentUser.name}</b><small>{currentUser.role === "admin" ? "系統管理員" : "內容審查員"}</small></span></div>
            </aside>

            <div className="admin-workspace-content">
              {adminWorkspace === "overview" && (
                <section className="admin-overview" aria-labelledby="admin-overview-title">
                  <div className="admin-workspace-heading"><div><span className="section-kicker">TODAY AT A GLANCE</span><h2 id="admin-overview-title">今天的審查概況</h2><p>從這裡開始，直接進入最需要處理的工作。</p></div><button type="button" className="secondary admin-refresh-button" onClick={() => void loadModerationPanel(currentUser)}><RotateCcw size={15} />重新整理</button></div>
                  <div className="admin-overview-grid">
                    <button type="button" className="admin-overview-card accent" onClick={() => openAdminWorkspace("listings")}><span className="admin-overview-card-icon"><BookOpen size={20} /></span><span><small>待審核刊登</small><strong>{pendingReviews.length}</strong><em>立即處理 →</em></span></button>
                    <button type="button" className="admin-overview-card danger" onClick={() => openAdminWorkspace("risk")}><span className="admin-overview-card-icon"><ShieldCheck size={20} /></span><span><small>風險待處理</small><strong>{riskSummary?.queueCount ?? 0}</strong><em>查看風險佇列 →</em></span></button>
                    <button type="button" className="admin-overview-card" onClick={() => openAdminWorkspace("reports")}><span className="admin-overview-card-icon"><Flag size={20} /></span><span><small>待處理檢舉</small><strong>{pendingReports.length}</strong><em>查看回報 →</em></span></button>
                    <button type="button" className="admin-overview-card" onClick={() => openAdminWorkspace("studentVerification")}><span className="admin-overview-card-icon"><GraduationCap size={20} /></span><span><small>學生證審核</small><strong>{studentVerifications.length}</strong><em>查看申請 →</em></span></button>
                  </div>
                  <div className="admin-overview-lower"><div className="admin-next-step"><div><span className="section-kicker">NEXT BEST ACTION</span><h3>先處理待審核刊登</h3><p>目前有 {pendingReviews.length} 筆刊登等待審核。開啟列表後可在右側抽屜查看完整內容並直接決定。</p></div><button type="button" className="primary" onClick={() => openAdminWorkspace("listings")}>開始審核 <ArrowRight size={16} /></button></div><div className="admin-quick-links"><span className="section-kicker">QUICK LINKS</span><button type="button" onClick={() => openAdminWorkspace("feedback")}>網站回饋 <ArrowRight size={15} /></button><button type="button" onClick={() => openAdminWorkspace("hiddenListings")}>已隱藏商品 <ArrowRight size={15} /></button></div></div>
                </section>
              )}

              {adminWorkspace === "risk" && (
                <section className="risk-panel" aria-labelledby="risk-panel-title">
            <div className="risk-panel-head">
              <div>
                <span className="section-kicker">TRUST & SAFETY</span>
                <h2 id="risk-panel-title">交易風險預警</h2>
                <p>先處理高／中風險項目；完整評價與檢舉證據只在開啟詳情後載入。</p>
              </div>
              <div className="risk-kpi-grid" aria-label="風險摘要">
                <div><small>待處理</small><b>{riskSummary?.queueCount ?? 0}</b></div>
                <div><small>高風險</small><b>{riskSummary?.highCount ?? 0}</b></div>
                <div><small>中風險</small><b>{riskSummary?.mediumCount ?? 0}</b></div>
                <div><small>全部名冊</small><b>{riskSummary?.allCount ?? 0}</b></div>
              </div>
            </div>
            <div className="risk-toolbar">
              <div className="risk-status-tabs" role="tablist" aria-label="風險審查狀態">
                {([
                  ["pending", "待處理"],
                  ["viewed", "已查看"],
                  ["processed", "已處理"],
                  ["all", "全部狀態"],
                ] as const).map(([status, label]) => (
                  <button key={status} type="button" role="tab" className={riskFilters.status === status ? "active" : ""} aria-selected={riskFilters.status === status} onClick={() => updateRiskFilter("status", status)}>{label}</button>
                ))}
              </div>
              <label className="risk-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">搜尋姓名或系所</span><input value={riskFilters.query} onChange={(event) => updateRiskFilter("query", event.target.value)} placeholder="搜尋姓名或系所" /></label>
              <select aria-label="風險等級" value={riskFilters.riskLevel} onChange={(event) => updateRiskFilter("riskLevel", event.target.value as RiskModerationFilters["riskLevel"])}>
                <option value="all">全部風險</option>
                <option value="high">高風險</option>
                <option value="medium">中風險</option>
                <option value="low">低風險</option>
              </select>
              <select aria-label="系所" value={riskFilters.department} onChange={(event) => updateRiskFilter("department", event.target.value)}>
                <option value="">全部系所</option>
                {departments.filter((item) => item !== departments[0]).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button type="button" className={riskFilters.scope === "all" ? "risk-scope-button active" : "risk-scope-button"} onClick={() => updateRiskFilter("scope", riskFilters.scope === "all" ? "queue" : "all")}>
                {riskFilters.scope === "all" ? "只看風險佇列" : "查看完整名冊"}
              </button>
            </div>
            {currentUser.role === "admin" && riskPolicy && (
              <details className="risk-policy-settings">
                <summary>風險規則設定</summary>
                <form className="risk-policy-form" onSubmit={saveRiskPolicy}>
                  <label>最少完成交易<input name="minCompletedTrades" type="number" min="1" max="1000" defaultValue={riskPolicy.minCompletedTrades} /></label>
                  <label>優良最低平均<input name="goodBadgeMinAverage" type="number" min="1" max="5" step="0.1" defaultValue={riskPolicy.goodBadgeMinAverage} /></label>
                  <label>優良最多嚴重檢舉<input name="goodBadgeMaxSeriousReports" type="number" min="0" max="1000" defaultValue={riskPolicy.goodBadgeMaxSeriousReports} /></label>
                  <label>中風險分數<input name="mediumRiskScore" type="number" min="1" defaultValue={riskPolicy.mediumRiskScore} /></label>
                  <label>高風險分數<input name="highRiskScore" type="number" min="1" defaultValue={riskPolicy.highRiskScore} /></label>
                  <div className="risk-actions"><button type="submit" className="primary">儲存風險門檻</button></div>
                </form>
              </details>
            )}
            <div className="risk-list-head"><strong>{riskFilters.scope === "all" ? "完整使用者名冊" : "待審查風險佇列"}</strong><span>{riskPageLoading ? "讀取中…" : `${riskProfileTotal} 筆`}</span></div>
            <div className="risk-profile-list">
              {riskProfiles.map((risk) => (
                <button type="button" className={`risk-profile-row ${risk.riskLevel}`} key={risk.userId} onClick={() => void openRiskProfile(risk.userId)}>
                  <span className={`risk-profile-avatar ${risk.riskLevel}`} aria-hidden="true">{risk.userName.slice(0, 1)}</span>
                  <span className="risk-profile-main"><strong>{risk.userName}</strong><small>{risk.userDepartment || "未填系所"} · {risk.completedTradeCount} 筆完成交易 · {risk.reviewCount ? `${risk.averageRating.toFixed(2)} 平均評分` : "尚無評分"}</small></span>
                  <span className={`risk-level ${risk.riskLevel}`}>{risk.riskLevel === "high" ? "高風險" : risk.riskLevel === "medium" ? "中風險" : "低風險"} · {risk.riskScore}</span>
                  <span className={`risk-review-status ${risk.reviewStatus}`}>{risk.reviewStatus === "pending" ? "待處理" : risk.reviewStatus === "viewed" ? "已查看" : "已處理"}</span>
                  <span className="risk-profile-arrow" aria-hidden="true">›</span>
                </button>
              ))}
              {!riskPageLoading && riskProfiles.length === 0 && <EmptyDashboard text={riskFilters.scope === "all" ? "找不到符合條件的使用者" : "目前沒有待處理的交易風險"} />}
            </div>
            <div className="risk-pagination">
              <span>{riskProfileTotal === 0 ? "0" : `${riskFilters.offset + 1}–${Math.min(riskFilters.offset + RISK_REVIEW_PAGE_SIZE, riskProfileTotal)}`} / {riskProfileTotal} 筆</span>
              <div><button type="button" disabled={riskFilters.offset === 0 || riskPageLoading} onClick={() => changeRiskPage(-1)}>上一頁</button><button type="button" disabled={riskFilters.offset + RISK_REVIEW_PAGE_SIZE >= riskProfileTotal || riskPageLoading} onClick={() => changeRiskPage(1)}>下一頁</button></div>
            </div>
                </section>
              )}

          {selectedRiskProfileId && (
            <ModalShell
              title={riskProfileDetail?.userName || "風險詳情"}
              subtitle={riskProfileDetail ? `${riskProfileDetail.userDepartment || "未填系所"} · 交易風險審查` : "正在載入風險資料"}
              onClose={() => { setSelectedRiskProfileId(null); setRiskProfileDetail(null); }}
              dialogClassName="risk-detail-modal"
            >
              {riskProfileDetailLoading && <div className="risk-detail-loading">正在載入評價與檢舉證據…</div>}
              {!riskProfileDetailLoading && riskProfileDetail && (
                <div className="risk-detail-content">
                  <div className="risk-detail-topline"><span className={`risk-level ${riskProfileDetail.riskLevel}`}>{riskProfileDetail.riskLevel === "high" ? "高風險" : riskProfileDetail.riskLevel === "medium" ? "中風險" : "低風險"} · {riskProfileDetail.riskScore}</span><span className={`risk-review-status ${riskProfileDetail.reviewStatus}`}>{riskProfileDetail.reviewStatus === "pending" ? "待處理" : riskProfileDetail.reviewStatus === "viewed" ? "已查看" : "已處理"}</span></div>
                  <div className="risk-summary-grid">
                    <div><small>完成交易</small><b>{riskProfileDetail.completedTradeCount}</b></div>
                    <div><small>平均評分</small><b>{riskProfileDetail.reviewCount ? riskProfileDetail.averageRating.toFixed(2) : "尚無"}</b></div>
                    <div><small>已解決檢舉</small><b>{riskProfileDetail.resolvedReportCount}</b></div>
                    <div><small>嚴重檢舉</small><b>{riskProfileDetail.seriousReportCount}</b></div>
                  </div>
                  <p className="risk-detail-meta">風險計算更新於 {timeAgo(riskProfileDetail.computedAt)}；狀態更新於 {riskProfileDetail.reviewUpdatedAt ? timeAgo(riskProfileDetail.reviewUpdatedAt) : "尚未更新"}</p>
                  <div className="risk-evidence-block"><h3>評價證據（{riskProfileDetail.reviewEvidence.length}）</h3>{riskProfileDetail.reviewEvidence.length === 0 ? <p>目前沒有評價證據。</p> : riskProfileDetail.reviewEvidence.map((evidence) => <p key={evidence.id}>評價 {evidence.rating} 星 · {evidence.reviewerName || "使用者"} · {evidence.comment || "無文字評論"}</p>)}</div>
                  <div className="risk-evidence-block"><h3>檢舉證據（{riskProfileDetail.reportEvidence.length}）</h3>{riskProfileDetail.reportEvidence.length === 0 ? <p>目前沒有檢舉證據。</p> : riskProfileDetail.reportEvidence.map((evidence) => <p key={evidence.id}>檢舉 {evidence.reason || "其他"} · {evidence.status} · {evidence.details || "無補充說明"}</p>)}</div>
                  <div className="risk-actions risk-detail-actions">
                    {riskProfileDetail.reviewStatus !== "viewed" && riskProfileDetail.reviewStatus !== "processed" && <button type="button" className="secondary" onClick={() => void changeRiskReviewStatus("viewed")}>標記已查看</button>}
                    {riskProfileDetail.reviewStatus !== "processed" && <button type="button" className="primary" onClick={() => void changeRiskReviewStatus("processed")}>標記已處理</button>}
                    {riskProfileDetail.reviewStatus === "processed" && <button type="button" className="secondary" onClick={() => void changeRiskReviewStatus("pending")}>重新開啟</button>}
                    {riskProfileDetail.sellerBadgeEligible && riskProfileDetail.sellerBadgeStatus !== "approved" && <button type="button" className="accept" onClick={() => void reviewTrustBadge(riskProfileDetail.userId, "seller", "approve")}><ShieldCheck size={16} />核准優良賣家</button>}
                    {riskProfileDetail.sellerBadgeStatus === "approved" && <button type="button" className="warn" onClick={() => void reviewTrustBadge(riskProfileDetail.userId, "seller", "revoke")}><EyeOff size={16} />撤下賣家徽章</button>}
                    {riskProfileDetail.buyerBadgeEligible && riskProfileDetail.buyerBadgeStatus !== "approved" && <button type="button" className="accept" onClick={() => void reviewTrustBadge(riskProfileDetail.userId, "buyer", "approve")}><ShieldCheck size={16} />核准推薦買家</button>}
                    {riskProfileDetail.buyerBadgeStatus === "approved" && <button type="button" className="warn" onClick={() => void reviewTrustBadge(riskProfileDetail.userId, "buyer", "revoke")}><EyeOff size={16} />撤下買家徽章</button>}
                  </div>
                </div>
              )}
            </ModalShell>
          )}

          {adminWorkspace === "feedback" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-feedback-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">PRODUCT FEEDBACK</span><h2 id="admin-feedback-title">網站問題回報</h2><p>集中處理使用者提出的體驗與功能問題。</p></div><span className="admin-panel-count">{pendingFeedback.length} 筆待處理</span></div>
          <div className="reports-list">
            {pendingFeedback.map((item) => (
              <article className="report-card" key={item.id}>
                <div className="report-card-head">
                  <span className="report-target user"><Flag size={14} />{feedbackCategoryLabels[item.category] || "其他"}</span>
                  <time>{timeAgo(item.createdAt)}</time>
                </div>
                <h3>{item.userName}</h3>
                <p>{item.message}</p>
                <div className="report-actions">
                  <button type="button" onClick={() => void resolveFeedback(item.id)}><Check size={16} />標記完成</button>
                </div>
              </article>
            ))}
          </div>
          {pendingFeedback.length === 0 && <EmptyDashboard text="目前沒有等待處理的問題回報" />}
            </section>
          )}

          {adminWorkspace === "studentVerification" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-student-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">VERIFICATION</span><h2 id="admin-student-title">學生證審核</h2><p>核對學生身分資料，完成後系統會保留審查紀錄。</p></div><span className="admin-panel-count">{studentVerifications.length} 筆待處理</span></div>
          <div className="reports-list">
            {studentVerifications.map((verification) => (
              <StudentVerificationCardWithZoom
                key={verification.id}
                verification={verification}
                onReview={reviewStudentVerification}
              />
            ))}
          </div>
          {studentVerifications.length === 0 && <EmptyDashboard text="目前沒有等待審核的學生證" />}
            </section>
          )}

          {adminWorkspace === "reports" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-reports-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">REPORTS</span><h2 id="admin-reports-title">待處理檢舉</h2><p>依檢舉內容判斷是否駁回、解決或採取限制措施。</p></div><span className="admin-panel-count">{pendingReports.length} 筆待處理</span></div>
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
                  <button type="button" onClick={() => void resolveReport(report.id, "dismiss")}><X size={16} />駁回</button>
                  <button type="button" onClick={() => void resolveReport(report.id, "resolve")}><Check size={16} />僅記錄並結案</button>
                  {report.targetType === "book" && <button type="button" className="warn" onClick={() => void resolveReport(report.id, "hide_book")}><EyeOff size={16} />隱藏商品</button>}
                  {currentUser.role === "admin" && <button type="button" className="danger" onClick={() => void resolveReport(report.id, "suspend_user")}><Ban size={16} />停權會員</button>}
                </div>
              </article>
            ))}
          </div>
          {pendingReports.length === 0 && <EmptyDashboard text="目前沒有等待處理的檢舉" />}
            </section>
          )}

          {adminWorkspace === "listings" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-listings-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">LISTING REVIEW</span><h2 id="admin-listings-title">待審核刊登</h2><p>點選「查看詳情」後，在右側抽屜完成審核，不必離開列表。</p></div><span className="admin-panel-count">{pendingReviews.length} 筆待處理</span></div>
          <div className="admin-listing-table-wrap">
            <table className="admin-listing-table"><thead><tr><th>刊登內容</th><th>賣家</th><th>價格</th><th>送審時間</th><th><span className="visually-hidden">操作</span></th></tr></thead><tbody>
            {pendingReviews.map((book) => {
              const seller = profile(book.sellerId);
              return (
                <tr key={book.id}><td><div className="admin-listing-title"><span className="admin-listing-thumb"><Image src={book.imageUrl} alt="" width={48} height={64} /></span><span><b>{book.title}</b><small>{[book.author, book.edition, book.publisher].filter(Boolean).join(" · ") || "二手商品"}</small></span></div></td><td><span className="admin-table-person"><b>{seller?.name || "使用者"}</b><small>{seller?.department || "未填系所"}</small></span></td><td><strong>{money(book.price)}</strong><small className="admin-table-muted">{book.condition}</small></td><td><span className="admin-table-muted">{timeAgo(book.createdAt)}</span></td><td><button type="button" className="admin-table-open" onClick={() => setSelectedAdminBook(book)}>查看詳情 <ArrowRight size={15} /></button></td></tr>
              );
            })}
            </tbody></table>
          </div>
          {pendingReviews.length === 0 && <EmptyDashboard text="目前沒有等待審核的書籍" />}
            </section>
          )}

          {adminWorkspace === "hiddenListings" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-hidden-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">HIDDEN LISTINGS</span><h2 id="admin-hidden-title">已隱藏商品</h2><p>檢視被暫時隱藏的刊登，確認後可恢復公開。</p></div><span className="admin-panel-count">{hiddenBooks.length} 筆</span></div>
              {hiddenBooks.length > 0 ? (
                <>
              <div className="permissions-list">
                {hiddenBooks.map((book) => (
                  <div className="permission-row" key={book.id}>
                    <span className="avatar"><EyeOff size={17} /></span>
                    <div><b>{book.title}</b><small>賣家：{profile(book.sellerId)?.name || "使用者"}</small></div>
                    <button type="button" className="restore-button" onClick={() => void restoreBook(book.id)}><RotateCcw size={15} />恢復顯示</button>
                  </div>
                ))}
              </div>
                </>
              ) : <EmptyDashboard text="目前沒有已隱藏的商品" />}
            </section>
          )}

          {adminWorkspace === "permissions" && currentUser.role === "admin" && (
            <section className="admin-workspace-panel" aria-labelledby="admin-permissions-title">
              <div className="admin-workspace-heading"><div><span className="section-kicker">ACCESS CONTROL</span><h2 id="admin-permissions-title">管理權限</h2><p>調整角色與帳號狀態，只有系統管理員可以進入此工作區。</p></div><span className="admin-panel-count">{store.profiles.length} 位使用者</span></div>
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
                        ? <button type="button" className="restore-button" onClick={() => void changeAccountStatus(user.id, "active")}><RotateCcw size={15} />解除停權</button>
                        : <button type="button" className="suspend-button" onClick={() => void changeAccountStatus(user.id, "suspended")}><Ban size={15} />停權</button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
            </div>
          </div>
          {selectedAdminBook && (
            <ModalShell
              title={selectedAdminBook.title}
              subtitle="刊登審核詳情"
              onClose={() => setSelectedAdminBook(null)}
              dialogClassName="admin-detail-drawer"
            >
              <div className="admin-detail-drawer-content">
                <div className="admin-detail-cover"><Image src={selectedAdminBook.imageUrl} alt={selectedAdminBook.title} width={180} height={240} /></div>
                <div className="admin-detail-summary"><span className="review-badge pending">待審核</span><h3>{selectedAdminBook.title}</h3><p>{[selectedAdminBook.author, selectedAdminBook.edition, selectedAdminBook.publisher].filter(Boolean).join(" · ") || "二手商品"}</p></div>
                <dl className="admin-detail-facts"><div><dt>賣家</dt><dd>{profile(selectedAdminBook.sellerId)?.name || "使用者"}</dd></div><div><dt>價格</dt><dd>{money(selectedAdminBook.price)}</dd></div><div><dt>書況</dt><dd>{selectedAdminBook.condition}</dd></div><div><dt>面交方式</dt><dd>{selectedAdminBook.meetup}</dd></div>{selectedAdminBook.isbn13 && <div><dt>ISBN-13</dt><dd>{selectedAdminBook.isbn13}</dd></div>}{selectedAdminBook.approvalNumber && <div><dt>審定字號</dt><dd>{selectedAdminBook.approvalNumber}</dd></div>}</dl>
                <div className="admin-detail-description"><span className="section-kicker">DESCRIPTION</span><p>{selectedAdminBook.description || "賣家沒有補充說明。"}</p></div>
                <div className="admin-detail-actions"><button type="button" className="reject" onClick={() => { setSelectedAdminBook(null); void reviewBook(selectedAdminBook.id, "rejected"); }}><X size={17} />拒絕刊登</button><button type="button" className="accept" onClick={() => { setSelectedAdminBook(null); void reviewBook(selectedAdminBook.id, "approved"); }}><Check size={17} />通過上架</button></div>
              </div>
            </ModalShell>
          )}
        </section>
      )}

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><BookOpen size={20} /></span><span><b>虎科書流</b><small>HUST BOOKFLOW</small></span></div>
        <p>{isSecondhandMode ? "讓每件校園好物，都找到下一位需要它的人。" : "讓每一本課本，都找到下一位需要它的人。"}</p>
        <button className="footer-feedback" type="button" onClick={() => requireLogin(() => setModal("feedback"))}>問題回報</button>
        <div className="footer-meta">
          <span>{isSecondhandMode ? "虎科校園二手交流平台" : "虎科校園課本交流平台"} · 2026</span>
          <nav aria-label="網站政策">
            <Link href="/privacy">隱私權</Link>
            <Link href="/terms">使用條款</Link>
            <Link href="/safety">交易安全</Link>
          </nav>
        </div>
      </footer>

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
          onDeleteAccount={deleteAccount}
        />
      )}
      {modal === "bookForm" && currentUser && (
        <BookFormModal
          book={editingBook}
          defaultListingType={listingFormType}
          userId={currentUser.id}
          saving={bookSaving}
          onClose={() => { if (bookSaving) return; setModal(null); setEditingBook(null); }}
          onSubmit={saveBook}
        />
      )}
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
          saving={requestSaving}
          onClose={() => { setModal(null); setEditingRequest(null); }}
          onOpenChat={() => {
            setModal(null);
            const activeRequest = editingRequest
              || store.requests.find((request) =>
                request.bookId === selectedBook.id
                && request.buyerId === currentUser?.id
                && ["pending", "waitlisted", "reserved", "awaiting_confirmation", "completed"].includes(request.status),
              )
              || null;
            if (activeRequest) {
              void openOrderConversation(activeRequest.id);
              return;
            }
            void startConversation(selectedBook.id);
          }}
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
      {modal === "tradeReview" && reviewRequest && reviewStatus && (
        <TradeReviewModal
          revieweeName={reviewStatus.revieweeName}
          onClose={() => { setModal(null); setReviewRequest(null); setReviewStatus(null); }}
          onSubmit={handleTradeReviewSubmit}
        />
      )}
      {modal === "feedback" && currentUser && (
        <FeedbackModal
          onClose={() => setModal(null)}
          onSubmit={submitFeedback}
        />
      )}
      {actionDialog.dialog && (
        <ActionDialog
          key={actionDialog.dialog.id}
          request={actionDialog.dialog}
          onCancel={actionDialog.cancel}
          onConfirm={actionDialog.confirm}
        />
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </main>
  );
}

function NativeDialog({
  className,
  label,
  labelledBy,
  onClose,
  closeOnBackdrop = true,
  children,
}: {
  className: string;
  label?: string;
  labelledBy?: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      {children}
    </dialog>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  closeOnBackdrop = true,
  dialogClassName = "",
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  dialogClassName?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();

  return (
    <NativeDialog
      className="modal-backdrop"
      labelledBy={headingId}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
    >
      <div
        className={`modal ${dialogClassName}`.trim()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="關閉視窗"><X aria-hidden="true" /></button>
        <div className="modal-heading">
          <span className="brand-mark"><BookOpen size={21} /></span>
          <div><h2 id={headingId}>{title}</h2><p>{subtitle}</p></div>
        </div>
        {children}
      </div>
    </NativeDialog>
  );
}

function ActionDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ActionDialogRequest;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(request.initialValue || "");

  return (
    <ModalShell title={request.title} subtitle="請確認這項操作的影響" onClose={onCancel}>
      <form
        className="form action-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(value.trim());
        }}
      >
        <p className="action-dialog-copy">{request.message}</p>
        {request.inputLabel && (
          <label>
            {request.inputLabel}
            <textarea
              rows={4}
              value={value}
              minLength={request.minLength || undefined}
              required={Boolean(request.minLength)}
              placeholder={request.inputPlaceholder}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        )}
        <div className="action-dialog-actions">
          <button type="button" className="ghost" onClick={onCancel}>返回</button>
          <button type="submit" className={request.danger ? "action-danger" : "primary"}>
            {request.confirmLabel || "確認"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
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
    try {
      const message = await onVerify(code);
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "驗證失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    try {
      const message = await onResend();
      if (message) setError(message);
      else setCode("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "驗證碼寄送失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
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

function StudentVerificationPanel({
  status,
  onSubmit,
}: {
  status: StudentVerificationSummary | null;
  onSubmit: (file: File, ocrText: string, qualityFlags: StudentVerificationFlags, studentNumber: string) => Promise<string | null>;
}) {
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [studentIdOcrText, setStudentIdOcrText] = useState("");
  const [studentIdFlags, setStudentIdFlags] = useState<StudentVerificationFlags | null>(null);
  const [studentIdDetails, setStudentIdDetails] = useState<StudentIdDetails | null>(null);
  const [studentIdPreview, setStudentIdPreview] = useState("");
  const [studentIdBusy, setStudentIdBusy] = useState(false);
  const [studentAiBusy, setStudentAiBusy] = useState(false);
  const [studentIdConsent, setStudentIdConsent] = useState(false);
  const [error, setError] = useState("");
  const [localPending, setLocalPending] = useState(false);

  useEffect(() => () => {
    if (studentIdPreview.startsWith("blob:")) URL.revokeObjectURL(studentIdPreview);
  }, [studentIdPreview]);

  const approvedAndCurrent = status?.status === "approved"
    && status.admissionYear !== null
    && isStudentIdYearEligible(status.admissionYear);
  const blocked = localPending || status?.status === "pending" || approvedAndCurrent;

  async function selectStudentIdImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setStudentIdFile(file);
    setStudentIdOcrText("");
    setStudentIdFlags(null);
    setStudentIdDetails(null);
    setError("");
    if (!file) {
      setStudentIdPreview("");
      return;
    }

    setStudentIdPreview(URL.createObjectURL(file));
    setStudentIdBusy(true);
    try {
      const { imageQualityFlags, recognizeStudentCardText } = await import("@/lib/marketplace/free-ocr");
      const { text: ocrText } = await Promise.race([
        recognizeStudentCardText(file),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("照片暫時無法辨識，請重新上傳清晰的學生證照片。")), 15000)),
      ]);
      const details = findStudentIdCandidates(ocrText)[0] ?? null;
      setStudentIdOcrText(ocrText);
      setStudentIdFlags(await imageQualityFlags(file, ocrText));
      setStudentIdDetails(details);
      if (!details) {
        setError("照片暫時無法辨識，請重新上傳清晰的學生證照片。");
      }
    } catch (ocrError) {
      const { imageQualityFlags } = await import("@/lib/marketplace/free-ocr");
      setStudentIdFlags(await imageQualityFlags(file, ""));
      setError(ocrError instanceof Error ? ocrError.message : "照片暫時無法辨識，請重新上傳清晰的學生證照片。");
    } finally {
      setStudentIdBusy(false);
    }
  }

  async function retryStudentIdWithAi() {
    if (!studentIdFile || !studentIdConsent) {
      setError("請先勾選同意，再使用 AI 辨識學生證。");
      return;
    }
    setStudentAiBusy(true);
    setError("");
    try {
      const { recognizeStudentCardWithAi } = await import("@/lib/marketplace/student-card-ai");
      const { parseStudentId } = await import("@/lib/marketplace/student-id");
      const result = await recognizeStudentCardWithAi(supabase!, studentIdFile, studentIdOcrText);
      const details = parseStudentId(result.studentNumber);
      if (!details) throw new Error("照片暫時無法辨識，請重新上傳清晰的學生證照片。");
      setStudentIdOcrText((previous) => `${previous}\n${details.value}`.trim());
      setStudentIdDetails(details);
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "目前無法完成辨識，請稍後再試。");
    } finally {
      setStudentAiBusy(false);
    }
  }

  async function submitStudentId() {
    const file = studentIdFile;
    const details = studentIdDetails;
    if (!file || !details) {
      setError("請重新上傳能被 OCR 辨識出學號的學生證照片。");
      return;
    }
    if (!studentIdConsent) {
      setError("請先同意學生證僅供平台驗證使用。");
      return;
    }

    setStudentIdBusy(true);
    setError("");
    const flags: StudentVerificationFlags = studentIdFlags
      ?? await import("@/lib/marketplace/free-ocr")
        .then(({ imageQualityFlags }) => imageQualityFlags(file, studentIdOcrText));
    const message = await onSubmit(file, studentIdOcrText, flags, details.value);
    if (message) {
      setError(message);
    } else {
      setLocalPending(true);
      setStudentIdFile(null);
      setStudentIdOcrText("");
      setStudentIdFlags(null);
      setStudentIdDetails(null);
      setStudentIdPreview("");
      setStudentIdConsent(false);
    }
    setStudentIdBusy(false);
  }

  return (
    <div className="dashboard-list">
      <section className="student-verification-box" aria-labelledby="student-verification-title">
        <div>
          <b id="student-verification-title">學生身分驗證</b>
          <span>驗證不是強制的；通過審核後，你的商品會優先顯示給買家。</span>
        </div>
        {status?.status === "pending" || localPending ? (
          <div className="readonly-notice"><Clock3 size={18} /><div><b>等待管理員審核</b><span>管理員會核對學生證圖片，請不要重複提交。</span></div></div>
        ) : status?.status === "approved" && approvedAndCurrent ? (
          <div className="readonly-notice"><ShieldCheck size={18} /><div><b>學生身分已驗證</b><span>你的商品目前享有已驗證賣家優先排序。</span></div></div>
        ) : status?.status === "rejected" ? (
          <p className="form-error">上次驗證未通過{status.reviewNote ? `：${status.reviewNote}` : "，請重新上傳清楚的學生證照片。"}</p>
        ) : status?.status === "approved" ? (
          <p className="form-note">原驗證已超過目前五年範圍，請提交最新學生證以恢復優先排序。</p>
        ) : null}
        {!blocked && (
          <>
            <label className="student-id-upload">
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="上傳學生證圖片" onChange={(event) => void selectStudentIdImage(event)} />
              <ImagePlus size={20} />
              <span>{studentIdFile?.name || "選擇學生證圖片"}</span>
            </label>
            {studentIdPreview && (
              <div className="student-id-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeImageSource(studentIdPreview)} alt="學生證預覽" />
              </div>
            )}
            {studentIdDetails && (
              <div className="student-id-result">
                <b>辨識出的學號：{studentIdDetails.value}</b>
                <span>請核對這 8 碼是否與學生證一致，再送出審核。</span>
              </div>
            )}
            <label className="student-id-consent">
              <input type="checkbox" checked={studentIdConsent} onChange={(event) => setStudentIdConsent(event.target.checked)} />
              <span>我同意學生證圖片與 OCR 結果僅供身分驗證，必要時送交 AI 辨識服務，審核完成後清除敏感內容。</span>
            </label>
            {error && <p className="form-error">{error}</p>}
            {!studentIdDetails && studentIdFile && !studentIdBusy && <button className="secondary-action wide" type="button" disabled={studentAiBusy || !studentIdConsent} onClick={() => void retryStudentIdWithAi()}>{studentAiBusy ? "AI 辨識中..." : "使用 AI 協助辨識"}</button>}
            <button className="secondary-action wide" type="button" disabled={studentIdBusy || !studentIdFile || !studentIdDetails || !studentIdConsent} onClick={() => void submitStudentId()}>
              {studentIdBusy ? "OCR 處理中..." : "送交學生身分審核"}
            </button>
            {!studentIdDetails && studentIdFile && !studentIdBusy && <p className="form-note">若無法讀取，請重新上傳清晰的學生證照片。</p>}
          </>
        )}
      </section>
    </div>
  );
}

function StudentVerificationCardWithZoom({
  verification,
  onReview,
}: {
  verification: StudentVerification;
  onReview: (verificationId: string, decision: "approved" | "rejected") => void | Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const flags = verification.qualityFlags as Partial<StudentVerificationFlags>;
  const flagLabels = studentVerificationFlagLabelsForDisplay({
    schoolMatched: Boolean(flags.schoolMatched),
    textTooShort: Boolean(flags.textTooShort),
    imageTooSmall: Boolean(flags.imageTooSmall),
  });

  useEffect(() => {
    if (!supabase || !verification.imagePath) return;
    let active = true;
    supabase.storage
      .from("student-verifications")
      .createSignedUrl(verification.imagePath, 600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setImageUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [verification.imagePath]);

  useEffect(() => {
    if (!imageViewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageViewerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageViewerOpen]);

  return (
    <>
      <article className="student-review-card">
        <div className="student-review-image">
          {imageUrl ? (
            <button
              type="button"
              className="student-review-image-button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setImageViewerOpen(true);
              }}
              aria-label="放大學生證圖片"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="學生證圖片，點擊放大" />
            </button>
          ) : <ShieldCheck size={28} />}
        </div>
        <div className="student-review-body">
          <div className="report-card-head">
            <span className="report-target user"><ShieldCheck size={14} />學生證審核</span>
            <time>{timeAgo(verification.createdAt)}</time>
          </div>
          <h3>{verification.userName}</h3>
          <div className="ocr-flags">
            {verification.programType && <span>{verification.programType === "four_year" ? "四技" : "二技"}</span>}
            {verification.admissionYear && <span>民國 {verification.admissionYear} 年</span>}
            {verification.departmentCode && <span>系所 {verification.departmentCode}</span>}
            {verification.classCode && <span>{verification.classCode} 班</span>}
          </div>
          <div className="ocr-flags">
            {flagLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
          <textarea className="ocr-text" readOnly value={verification.ocrText || "OCR 未讀到可用文字，請直接人工檢查圖片。"} aria-label="學生證 OCR 文字" />
          <div className="report-actions">
            <button type="button" className="accept" onClick={() => void onReview(verification.id, "approved")}><Check size={16} />通過學生證</button>
            <button type="button" className="reject" onClick={() => void onReview(verification.id, "rejected")}><X size={16} />拒絕</button>
          </div>
        </div>
      </article>
      {imageViewerOpen && imageUrl && (
        <NativeDialog className="student-card-lightbox" label="放大的學生證圖片" onClose={() => setImageViewerOpen(false)}>
          <button type="button" className="student-card-lightbox-close" onClick={() => setImageViewerOpen(false)} aria-label="關閉圖片"><X size={24} /></button>
          <div className="student-card-lightbox-content">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="放大的學生證圖片" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
          </div>
          <div className="student-card-lightbox-controls">
            <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.25))} aria-label="放大"><ZoomIn size={18} /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="縮小"><ZoomOut size={18} /></button>
            <button type="button" onClick={() => setZoom(1)} aria-label="重設大小">100%</button>
            <button type="button" onClick={() => setRotation((value) => value + 90)} aria-label="旋轉圖片"><RotateCcw size={18} /></button>
          </div>
        </NativeDialog>
      )}
    </>
  );
}

function ProfileModal({
  profile,
  onClose,
  onSubmit,
  onDeleteAccount,
}: {
  profile: Profile;
  onClose: () => void;
  onSubmit: (name: string, department: string) => Promise<string | null>;
  onDeleteAccount: () => Promise<string | null>;
}) {
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const actionDialog = useActionDialog();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const message = await onSubmit(name, department);
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "個人資料更新失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function requestAccountDeletion() {
    const confirmation = await actionDialog.ask({
      title: "刪除並匿名化帳號",
      message: "此操作無法復原。公開個資、非必要圖片與推播訂閱會移除；進行中的交易會取消。必要的交易、防詐與管理稽核紀錄會以匿名方式保留。",
      inputLabel: "輸入 DELETE 確認",
      inputPlaceholder: "DELETE",
      minLength: 6,
      confirmLabel: "永久刪除帳號",
      danger: true,
    });
    if (confirmation === null) return;
    if (confirmation !== "DELETE") {
      setError("請完整輸入大寫 DELETE 才能刪除帳號");
      return;
    }
    setDeletingAccount(true);
    setError("");
    try {
      const message = await onDeleteAccount();
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "帳號刪除失敗，請稍後再試");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <>
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
      <div className="account-deletion-box">
        <div>
          <b>刪除帳號與個人資料</b>
          <span>公開資料會匿名化，登入帳號與非必要圖片會移除；依法或安全所需的最小交易紀錄會保留。</span>
        </div>
        <button
          className="account-delete-button"
          type="button"
          disabled={deletingAccount}
          onClick={() => void requestAccountDeletion()}
        >
          <Trash2 size={16} />{deletingAccount ? "刪除中..." : "刪除帳號"}
        </button>
      </div>
    </ModalShell>
    {actionDialog.dialog && (
      <ActionDialog
        key={actionDialog.dialog.id}
        request={actionDialog.dialog}
        onCancel={actionDialog.cancel}
        onConfirm={actionDialog.confirm}
      />
    )}
    </>
  );
}

function FeedbackModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell title="問題回報" subtitle="告訴我們網站哪裡出現問題" onClose={onClose}>
      <form className="form" onSubmit={onSubmit}>
        <label>
          問題類型
          <select name="category" defaultValue="bug">
            <option value="bug">問題回報</option>
            <option value="suggestion">功能建議</option>
            <option value="experience">使用體驗</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          問題內容
          <textarea
            name="message"
            minLength={10}
            maxLength={2000}
            rows={7}
            placeholder="請描述你在哪個頁面、做了什麼、遇到什麼狀況..."
            required
          />
        </label>
        <p className="form-note">請勿填寫密碼、驗證碼或其他敏感資料。</p>
        <button className="primary wide" type="submit"><Flag size={16} />送出問題回報</button>
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
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("signup");
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
    try {
      const message = await onGoogleLogin();
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google 登入失敗，請稍後再試");
    } finally {
      setOauthLoading(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const message = await onLogin(email.trim(), password);
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "登入失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
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
    try {
      const message = await onSignUp(name.trim(), department, email.trim(), password);
      if (message) setError(message);
      else {
        setSignupStep("code");
        setResendCooldown(60);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "註冊失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const message = await onVerifySignup(email.trim(), code.trim());
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "驗證失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const message = await onResendSignup(email.trim());
      if (message) setError(message);
      else setResendCooldown(60);
    } catch (error) {
      setError(error instanceof Error ? error.message : "驗證碼寄送失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function submitForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const message = await onRequestReset(email.trim());
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "重設密碼信寄送失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
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
    try {
      const message = await onSubmit(password);
      if (message) setError(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "密碼更新失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
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

function BookFormModal({
  book,
  defaultListingType,
  userId,
  saving,
  onClose,
  onSubmit,
}: {
  book: Book | null;
  defaultListingType: ListingType;
  userId: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const initialListingType = book?.listingType ?? defaultListingType;
  const value = book ?? {
    ...blankBook,
    listingType: initialListingType,
    itemCategory: initialListingType === "secondhand" ? DEFAULT_SECONDHAND_CATEGORY : "book",
  };
  const [preview, setPreview] = useState(() => safeImageSource(value.imageUrl));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ocrReferenceFile, setOcrReferenceFile] = useState<File | null>(null);
  const [ocrOriginalDraft, setOcrOriginalDraft] = useState<BookOcrDraft | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState("");
  const [showCourseHelp, setShowCourseHelp] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const ocrRequestRef = useRef(0);
  const baseDraft = useMemo(() => ({
    title: value.title,
    author: value.author,
    edition: value.edition,
    department: value.department,
    course: value.course,
    teacher: value.teacher,
    condition: value.condition,
    price: value.price ? String(value.price) : "",
    meetup: value.meetup,
    description: value.description,
    itemCategory: value.itemCategory === "book" ? DEFAULT_SECONDHAND_CATEGORY : value.itemCategory,
  }), [
    value.author,
    value.condition,
    value.course,
    value.department,
    value.description,
    value.edition,
    value.itemCategory,
    value.meetup,
    value.price,
    value.teacher,
    value.title,
  ]);
  const draftStorageKey = listingDraftStorageKey(userId, initialListingType, book?.id);
  const baseDraftSignatureRef = useRef(JSON.stringify(baseDraft));
  const skipDraftPersistenceRef = useRef(true);
  const [draft, setDraft] = useState(baseDraft);
  const draftChanged = JSON.stringify(draft) !== baseDraftSignatureRef.current;
  const dirty = imageFile !== null || ocrReferenceFile !== null || draftChanged;
  const isSecondhand = initialListingType === "secondhand";

  useEffect(() => {
    let hydratedBase = baseDraft;
    try {
      if (!book && initialListingType === "book") {
        const savedDepartment = window.localStorage.getItem(listingDepartmentStorageKey(userId)) || "";
        if (departments.slice(1).includes(savedDepartment)) {
          hydratedBase = { ...hydratedBase, department: hydratedBase.department || savedDepartment };
        }
      }
      baseDraftSignatureRef.current = JSON.stringify(hydratedBase);
      const saved = window.localStorage.getItem(draftStorageKey);
      setDraft(saved
        ? { ...hydratedBase, ...(JSON.parse(saved) as Partial<typeof baseDraft>) }
        : hydratedBase);
    } catch {
      baseDraftSignatureRef.current = JSON.stringify(hydratedBase);
      setDraft(hydratedBase);
    }
    skipDraftPersistenceRef.current = true;
  }, [baseDraft, book, draftStorageKey, initialListingType, userId]);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (skipDraftPersistenceRef.current) {
      skipDraftPersistenceRef.current = false;
      return;
    }
    if (!draftChanged) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftChanged, draft, draftStorageKey]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  function requestClose() {
    try {
      if (draftChanged) {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(draftStorageKey);
      }
    } catch {
      // Closing the form must still work when browser storage is unavailable.
    }
    onClose();
  }

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 2);
    const file = files[0];
    if (!file) return;
    ocrRequestRef.current += 1;
    setOcrBusy(false);
    setOcrProgress(0);
    setImageFile(file);
    setOcrReferenceFile(files[1] || null);
    setPreview(URL.createObjectURL(file));
    if (!isSecondhand) {
      setOcrMessage(files[1]
        ? "正面與背面照片已準備好；系統會合併封面文字與背面 ISBN 線索。"
        : "照片已準備好；若有背面 ISBN，可一次選擇正反兩張照片提高辨識率。");
      void import("@/lib/marketplace/free-ocr")
        .then(({ warmBookOcr }) => warmBookOcr())
        .catch(() => undefined);
    }
  }

  function updateDraft(field: keyof typeof draft, nextValue: string) {
    if (field === "department" && initialListingType === "book" && !book && departments.slice(1).includes(nextValue)) {
      try {
        window.localStorage.setItem(listingDepartmentStorageKey(userId), nextValue);
      } catch {
        // Remembering the last department is a convenience only.
      }
    }
    setDraft((previous) => ({ ...previous, [field]: nextValue }));
  }

  async function readBookOcr() {
    if (!imageFile || isSecondhand) return;
    const requestId = ++ocrRequestRef.current;
    setOcrBusy(true);
    setOcrProgress(4);
    setOcrMessage("正在準備照片...");
    try {
      const { recognizeBookCover } = await import("@/lib/marketplace/free-ocr");
      const ocrImageFile = await compressBookOcrImage(imageFile);
      const primaryResult = await recognizeBookCover(ocrImageFile, (stage, progress) => {
        const percent = Math.max(1, Math.round((progress ?? 0) * 100));
        if (stage === "preparing") {
          setOcrProgress(8);
          setOcrMessage("正在準備照片...");
        }
        if (stage === "english") {
          setOcrProgress(Math.min(45, 10 + Math.round(percent * 0.35)));
          setOcrMessage("正在讀取封面上的書名與作者...");
        }
        if (stage === "chinese") {
          setOcrProgress(Math.min(80, 45 + Math.round(percent * 0.35)));
          setOcrMessage("正在整理可填入的欄位...");
        }
      });
      if (requestId !== ocrRequestRef.current) return;
      setOcrProgress(84);
      const referenceResult = ocrReferenceFile
        ? await recognizeBookCover(await compressBookOcrImage(ocrReferenceFile))
        : null;
      if (requestId !== ocrRequestRef.current) return;
      setOcrProgress(88);
      const candidates = rankTaiwanTextbookCandidates([
        {
          source: "front_ocr",
          confidence: primaryResult.confidence,
          draft: primaryResult.draft,
        },
        ...(referenceResult ? [{
          source: "back_ocr" as const,
          confidence: referenceResult.confidence,
          draft: referenceResult.draft,
        }] : []),
      ]);
      const mergedLocalDraft = candidates
        .slice()
        .reverse()
        .reduce<BookOcrDraft>((combined, candidate) => ({
          ...combined,
          ...Object.fromEntries(
            Object.entries(candidate.draft).filter(([, field]) => Boolean(field)),
          ),
        }), {});
      const localText = [primaryResult.text, referenceResult?.text].filter(Boolean).join("\n");
      const needsAiFallback = !mergedLocalDraft.title
        || (primaryResult.needsAiFallback && (referenceResult?.needsAiFallback ?? true));
      let ocrDraft = needsAiFallback
        ? {
            title: "",
            author: "",
            edition: "",
          }
        : {
            title: mergedLocalDraft.title,
            author: mergedLocalDraft.author,
            edition: mergedLocalDraft.edition,
          };
      let aiFallbackError = "";
      if (needsAiFallback && supabase) {
        setOcrProgress(90);
        setOcrMessage("正在提高辨識準確度...");
        try {
          const { recognizeBookCoverWithAi } = await import("@/lib/marketplace/book-ocr-ai");
          const aiResult = await recognizeBookCoverWithAi(supabase, ocrImageFile, localText);
          if (requestId !== ocrRequestRef.current) return;
          ocrDraft = {
            ...ocrDraft,
            ...Object.fromEntries(
              Object.entries(aiResult.draft).filter(([, field]) => Boolean(field)),
            ),
          };
          setOcrProgress(96);
        } catch (aiError) {
          aiFallbackError = aiError instanceof Error ? aiError.message : "暫時無法提高辨識準確度";
        }
      }
      setDraft((previous) => {
        const next = { ...previous };
        for (const field of ["title", "author", "edition"] as const) {
          const recognized = ocrDraft[field]?.trim() || "";
          const current = previous[field].trim();
          const previousAuto = ocrOriginalDraft?.[field]?.trim() || "";
          if (recognized && (!current || (previousAuto && current === previousAuto))) {
            next[field] = recognized;
          }
        }
        return next;
      });
      setOcrOriginalDraft(ocrDraft);
      setOcrProgress(100);
      setOcrMessage(ocrDraft.title || ocrDraft.author || ocrDraft.edition
        ? `已填入可辨識的欄位，送出前請再確認。${aiFallbackError ? ` ${aiFallbackError}` : ""}`
        : aiFallbackError
          ? `這張照片暫時無法辨識，沒有覆寫你的欄位。你可以換一張清楚的封面，或手動填寫。 ${aiFallbackError}`
          : "這張照片暫時無法辨識，沒有覆寫你的欄位。你可以換一張清楚的封面，或手動填寫。");
    } catch (error) {
      if (requestId !== ocrRequestRef.current) return;
      setOcrProgress(0);
      setOcrMessage(error instanceof Error ? error.message : "這張照片暫時無法辨識，請改用手動填寫。");
  } finally {
      if (requestId === ocrRequestRef.current) setOcrBusy(false);
    }
  }

  function preventImplicitSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) return;
    if (target instanceof HTMLInputElement && ["button", "submit", "file"].includes(target.type)) return;
    event.preventDefault();
  }

  return (
    <>
    <ModalShell
      title={book ? "編輯刊登" : isSecondhand ? "刊登二手物品" : "刊登一本課本"}
      subtitle="標示 * 的欄位為必填；文字草稿會自動保留在這台裝置"
      onClose={requestClose}
      closeOnBackdrop={false}
    >
      <form onSubmit={onSubmit} onKeyDown={preventImplicitSubmit} className="form book-form">
        <fieldset disabled={saving} className="book-form-fields">
          <p className="listing-file-help full">
            <b>{isSecondhand ? "商品圖片" : "封面圖片"} *</b>
            <span>{book ? "不選擇新圖片會保留原圖。" : "支援 JPG、PNG、WebP，最大 5MB。"}</span>
          </p>
          <input
            ref={imageInputRef}
            className="listing-file-input full"
            name="image"
            required={!book}
            type="file"
            multiple={!isSecondhand}
            accept="image/jpeg,image/png,image/webp"
            onChange={selectImage}
            aria-label={isSecondhand ? "選擇商品照片" : "選擇課本封面"}
          />
          <input type="hidden" name="listingType" value={initialListingType} />
          <input type="hidden" name="ocrOriginal" value={ocrOriginalDraft ? JSON.stringify(ocrOriginalDraft) : ""} />
          {preview && (
            <div className="image-preview full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={safeImageSource(preview)} alt={isSecondhand ? "商品圖片預覽" : "書籍封面預覽"} />
            </div>
          )}

          {!isSecondhand && (
            <div className="photo-assist full">
              <div>
                <Sparkles size={18} aria-hidden="true" />
                <span>
                  <b>使用照片填寫課本資料</b>
                  <small>拍清楚封面後，系統會先辨識書名、作者、版本與出版線索；價格仍由你自己填。</small>
                </span>
              </div>
              <div className="photo-assist-actions">
                <button type="button" className="ghost" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus size={16} />{imageFile ? "重新選擇照片" : "選擇封面照片"}
                </button>
                <button type="button" disabled={ocrBusy || !imageFile} onClick={() => void readBookOcr()}>
                  <Sparkles size={16} />{ocrBusy ? "辨識中..." : "使用照片辨識"}
                </button>
              </div>
              {(ocrBusy || ocrProgress > 0) && (
                <div className="ocr-progress" aria-live="polite">
                  <progress value={ocrProgress} max={100} aria-label="照片辨識進度" />
                  <span>{ocrBusy ? `${ocrProgress}%` : "辨識完成"}</span>
                </div>
              )}
              <p>{ocrMessage || "辨識結果只會填入草稿，送出前請再確認。"}</p>
              <p className="ocr-privacy-note">本機辨識不足時，照片可能會短暫用於提高辨識準確度；BookFlow 不會另外保存這次辨識圖片。</p>
            </div>
          )}

          <label className="full">
            {isSecondhand ? "商品名稱" : "書名"} *
            <input name="title" required maxLength={LISTING_FIELD_LIMITS.title} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder={isSecondhand ? "例如：小米檯燈、藍牙耳機" : "例如：資料結構：使用 C++"} />
          </label>

          {isSecondhand ? (
            <>
              <input type="hidden" name="author" value="" />
              <input type="hidden" name="edition" value="" />
              <input type="hidden" name="publisher" value="" />
              <input type="hidden" name="department" value="" />
              <input type="hidden" name="course" value="" />
              <input type="hidden" name="teacher" value="" />
              <input type="hidden" name="educationLevel" value="" />
              <input type="hidden" name="grade" value="" />
              <input type="hidden" name="semester" value="" />
              <input type="hidden" name="subject" value="" />
              <input type="hidden" name="volume" value="" />
              <input type="hidden" name="curriculum" value="" />
              <input type="hidden" name="bookType" value="" />
              <input type="hidden" name="isbn13" value="" />
              <input type="hidden" name="approvalNumber" value="" />
              <label>
                二手分類 *
                <select name="itemCategory" required value={draft.itemCategory} onChange={(event) => updateDraft("itemCategory", event.target.value)}>
                  {SECONDHAND_CATEGORIES.slice(1).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              <input type="hidden" name="itemCategory" value="book" />
              <input type="hidden" name="publisher" value={value.publisher} />
              <input type="hidden" name="educationLevel" value={value.educationLevel} />
              <input type="hidden" name="grade" value={value.grade} />
              <input type="hidden" name="semester" value={value.semester} />
              <input type="hidden" name="subject" value={value.subject} />
              <input type="hidden" name="volume" value={value.volume} />
              <input type="hidden" name="curriculum" value={value.curriculum} />
              <input type="hidden" name="bookType" value={value.bookType} />
              <input type="hidden" name="isbn13" value={value.isbn13} />
              <input type="hidden" name="approvalNumber" value={value.approvalNumber} />
              <label>作者 *<input name="author" required maxLength={LISTING_FIELD_LIMITS.author} value={draft.author} onChange={(event) => updateDraft("author", event.target.value)} /></label>
              <label>版本（選填）<input name="edition" maxLength={LISTING_FIELD_LIMITS.edition} value={draft.edition} onChange={(event) => updateDraft("edition", event.target.value)} placeholder="例如：第 2 版" /></label>
              <label>科系（選填）<select name="department" value={draft.department} onChange={(event) => updateDraft("department", event.target.value)}><option value="">不指定科系</option>{departments.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field-with-help">
                <span className="field-label-row">
                  課堂名稱（選填）
                  <span className="field-help-anchor">
                    <button
                      type="button"
                      className="field-help-button"
                      aria-label="課堂名稱填寫說明"
                      aria-expanded={showCourseHelp}
                      onClick={() => setShowCourseHelp((open) => !open)}
                    >
                      <HelpCircle size={15} aria-hidden="true" />
                    </button>
                    {showCourseHelp && (
                      <small className="field-help-text" role="tooltip">
                        填課表上的課名、老師常用的課堂名稱，或同學搜尋時會打的稱呼；不確定可以留空。
                      </small>
                    )}
                  </span>
                </span>
                <input name="course" maxLength={LISTING_FIELD_LIMITS.course} value={draft.course} onChange={(event) => updateDraft("course", event.target.value)} placeholder="例如：資料結構、微積分（一）" />
              </label>
              <label>授課老師（選填）<input name="teacher" maxLength={LISTING_FIELD_LIMITS.teacher} value={draft.teacher} onChange={(event) => updateDraft("teacher", event.target.value)} /></label>
            </>
          )}

          <label>
            {isSecondhand ? "物況" : "書況"} *
            <select name="condition" required value={draft.condition} onChange={(event) => updateDraft("condition", event.target.value)}>
              <option>近全新</option>
              <option>{isSecondhand ? "狀況良好" : "書況良好"}</option>
              <option>{isSecondhand ? "正常使用痕跡" : "有筆記"}</option>
              <option>使用痕跡明顯</option>
              <option>損壞嚴重</option>
            </select>
          </label>
          <label>價格（NT$）*<input name="price" required type="number" min="0" max={LISTING_FIELD_LIMITS.price} step="1" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} /></label>
          <label className="full">面交地點 *<input name="meetup" required maxLength={LISTING_FIELD_LIMITS.meetup} value={draft.meetup} onChange={(event) => updateDraft("meetup", event.target.value)} placeholder="例如：圖書館一樓" /></label>
          <label className="full">{isSecondhand ? "商品說明" : "書況說明"} *<textarea name="description" required maxLength={LISTING_FIELD_LIMITS.description} rows={3} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
          <button className="primary wide full" type="submit" disabled={saving}>{saving ? (book ? "儲存中..." : "刊登中...") : book ? "儲存變更" : "確認刊登"}</button>
        </fieldset>
      </form>
    </ModalShell>
    </>
  );
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
  saving,
  onClose,
  onOpenChat,
  onSubmit,
}: {
  book: Book;
  request?: PurchaseRequest | null;
  saving: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [message, setMessage] = useState(request?.message || REQUEST_PHRASES[0]);
  const [versionConfirmed, setVersionConfirmed] = useState(book.listingType !== "book");
  const [preferredMeetupLocation, setPreferredMeetupLocation] = useState(request?.preferredMeetupLocation || "");
  const [preferredMeetupTime, setPreferredMeetupTime] = useState(request?.preferredMeetupTime || "");
  const versionDetails = [
    book.publisher && `出版社：${book.publisher}`,
    book.edition && `版本：${book.edition}`,
    book.volume && `冊次：${book.volume}`,
    book.curriculum && `課綱：${book.curriculum}`,
    book.isbn13 && `ISBN：${book.isbn13}`,
  ].filter(Boolean);

  return (
    <ModalShell title="確認下訂" subtitle={`想購買《${book.title}》`} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <div className="request-summary"><span>{book.condition}</span><b>{money(book.price)}</b><span><MapPin size={14} />{book.meetup}</span></div>
        {book.listingType === "book" && (
          <label className="version-confirmation">
            <input
              type="checkbox"
              checked={versionConfirmed}
              onChange={(event) => setVersionConfirmed(event.target.checked)}
              required
            />
            <span>
              <b>我已確認不是買錯版本</b>
              <small>{versionDetails.length > 0 ? versionDetails.join(" · ") : "此刊登的版本資料不完整，請先在聊聊向賣家確認出版社、冊次、ISBN 與課綱。"}</small>
            </span>
          </label>
        )}
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
        <div className="request-coordination-card">
          <div className="request-coordination-head">
            <b>想約的面交資訊</b>
            <small>還沒確定也可以先留空，先去聊聊確認。</small>
          </div>
          <label>
            希望面交地點（選填）
            <input
              name="preferredMeetupLocation"
              maxLength={REQUEST_COORDINATION_MAX_LENGTH}
              value={preferredMeetupLocation}
              onChange={(event) => setPreferredMeetupLocation(event.target.value)}
              placeholder="例如：圖書館一樓、第一教學區"
            />
          </label>
          <label>
            希望面交時間（選填）
            <input
              name="preferredMeetupTime"
              maxLength={REQUEST_COORDINATION_MAX_LENGTH}
              value={preferredMeetupTime}
              onChange={(event) => setPreferredMeetupTime(event.target.value)}
              placeholder="例如：週三下午、今晚 7 點後"
            />
          </label>
          <div className="request-coordination-actions">
            <button type="button" className="ghost" onClick={onOpenChat}>
              <MessageCircle size={16} />
              先去聊聊確認
            </button>
            <small>送出後，在賣家按下「已完成面交」前，都能回聊天室再修改。</small>
          </div>
        </div>
        <button className="primary wide" type="submit" disabled={!versionConfirmed || saving}>
          {request ? <Pencil size={17} /> : <MessageCircle size={17} />}
          {saving ? "送出中..." : request ? "儲存訂單修改" : "確認下訂"}
        </button>
        <p className="form-note">下訂後仍需等待賣家選定，不代表交易完成；若時間地點還沒談好，先用聊聊確認最穩妥。</p>
      </form>
    </ModalShell>
  );
}

function TradeReviewModal({
  revieweeName,
  onClose,
  onSubmit,
}: {
  revieweeName: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const tags: Array<[TradeReviewTag, string]> = [
    ["item_as_described", "物品符合描述"],
    ["punctual", "準時守約"],
    ["clear_communication", "溝通清楚"],
    ["no_show", "未依約出現"],
    ["misleading", "資訊不符"],
  ];
  return (
    <ModalShell title="評價這次交易" subtitle={"分享你與 " + revieweeName + " 的交易體驗"} onClose={onClose}>
      <form className="form trade-review-form" onSubmit={onSubmit}>
        <fieldset>
          <legend>整體評分</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((rating) => (
              <label key={rating}>
                <input type="radio" name="rating" value={rating} required />
                <span aria-hidden="true">{Array.from({ length: rating }, () => "★").join("")}</span>
                <small>{rating} 星</small>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>交易標籤（可複選）</legend>
          <div className="review-tag-options">
            {tags.map(([value, label]) => (
              <label key={value}><input type="checkbox" name="tags" value={value} />{label}</label>
            ))}
          </div>
        </fieldset>
        <label>補充說明（選填）<textarea name="comment" maxLength={500} placeholder="只會提供給管理員作為風險審核依據" /></label>
        <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>取消</button><button type="submit" className="primary">送出評價</button></div>
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

function RequestCoordinationPanel({
  request,
  viewer,
}: {
  request: PurchaseRequest;
  viewer: "buyer" | "seller";
}) {
  const lines = requestCoordinationLines(request);
  if (lines.length === 0) {
    return (
      <div className="request-coordination-note is-empty">
        {viewer === "buyer"
          ? "你還沒填寫希望的面交時間或地點，可以先去聊聊和賣家確認。"
          : "買家還沒填寫希望的面交時間或地點，建議先到聊聊確認。"}
      </div>
    );
  }
  return (
    <div className="request-coordination-note">
      <b>{viewer === "buyer" ? "你填寫的面交偏好" : "買家填寫的面交偏好"}</b>
      <ul>
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
function TradeChatPanel({
  conversation,
  book,
  request,
  currentUser,
  currentUserId,
  profiles,
  onChanged,
  onRead,
  onBack,
  onHide,
  onOpenBook,
  onEditRequest,
  onRespondToRequest,
}: {
  conversation: Conversation;
  book: Book | null;
  request: PurchaseRequest | null;
  currentUser: Profile;
  currentUserId: string;
  profiles: Profile[];
  onChanged: () => void;
  onRead: (conversationId: string) => void;
  onBack: () => void;
  onHide: () => void;
  onOpenBook: (bookId: string) => void;
  onEditRequest: () => void;
  onRespondToRequest: (requestId: string, status: "accepted" | "rejected") => void | Promise<void>;
}) {
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [showQuickPhrases, setShowQuickPhrases] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const actionDialog = useActionDialog();
  const logRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const messageCursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const sendingRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const sentByCurrentUserRef = useRef(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [messageActionNow, setMessageActionNow] = useState<number | null>(null);
  const otherUserId = conversation.buyerId === currentUserId ? conversation.sellerId : conversation.buyerId;
  const isSeller = conversation.sellerId === currentUserId;
  const canRespondToRequest = Boolean(
    isSeller
    && request
    && ["pending", "waitlisted"].includes(request.status)
    && book?.status === "available",
  );
  const canEditRequestFromChat = Boolean(
    !isSeller
    && request
    && ["pending", "waitlisted", "reserved"].includes(request.status),
  );

  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [draft]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    void fetchTradeMessages(client, conversation.id)
      .then(async (page) => {
        if (!active) return;
        setMessages(page.messages);
        lastMessageCountRef.current = page.messages.length;
        stickToBottomRef.current = true;
        window.requestAnimationFrame(() => scrollChatLogToBottom("auto"));
        setShowQuickPhrases(!page.messages.some((item) => item.senderId === currentUserId));
        setHasOlderMessages(page.hasMore);
        messageCursorRef.current = page.nextCursor;
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
  }, [conversation.id, currentUserId, onRead]);

  useEffect(() => {
    const updateMessageActionTime = () => setMessageActionNow(Date.now());
    updateMessageActionTime();
    const interval = window.setInterval(updateMessageActionTime, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const messageCount = messages.length;
    const addedMessage = messageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = messageCount;
    if (!addedMessage) return;
    if (stickToBottomRef.current || sentByCurrentUserRef.current) {
      sentByCurrentUserRef.current = false;
      setHasUnreadBelow(false);
      scrollChatLogToBottom("smooth");
    } else {
      setHasUnreadBelow(true);
    }
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
    if (!supabase || sendingRef.current || (!draft.trim() && files.length === 0)) return;
    sendingRef.current = true;
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
      sentByCurrentUserRef.current = true;
      setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
      if (uploadedPaths.length > 0) {
        const signed = await signChatImages(supabase, uploadedPaths);
        setImageUrls((previous) => ({ ...previous, ...signed }));
      }
      setFiles([]);
      setShowQuickPhrases(false);
      void dispatchBrowserPush(supabase);
    } catch (sendError) {
      if (uploadedPaths.length > 0) {
        await deleteChatImageUploads(supabase, uploadedPaths).catch(() => undefined);
      }
      setDraft(body);
      setError(sendError instanceof Error ? sendError.message : "訊息傳送失敗");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const senderName = (senderId: string) => profiles.find((profile) => profile.id === senderId)?.name || "使用者";

  function updateStickToBottom() {
    const log = logRef.current;
    if (!log) return;
    const distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) setHasUnreadBelow(false);
  }

  function scrollChatLogToBottom(behavior: ScrollBehavior) {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({ top: log.scrollHeight, behavior });
  }

  function scrollToLatestMessage() {
    stickToBottomRef.current = true;
    setHasUnreadBelow(false);
    scrollChatLogToBottom("smooth");
  }

  async function loadOlderMessages() {
    const cursor = messageCursorRef.current;
    if (!supabase || !cursor || loadingOlder) return;
    const log = logRef.current;
    const previousScrollHeight = log?.scrollHeight ?? 0;
    const previousScrollTop = log?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const page = await fetchTradeMessages(supabase, conversation.id, cursor);
      setMessages((previous) => [
        ...page.messages.filter((item) => !previous.some((existing) => existing.id === item.id)),
        ...previous,
      ]);
      setHasOlderMessages(page.hasMore);
      messageCursorRef.current = page.nextCursor;
      window.requestAnimationFrame(() => {
        if (!logRef.current) return;
        const heightDelta = logRef.current.scrollHeight - previousScrollHeight;
        logRef.current.scrollTop = previousScrollTop + heightDelta;
      });
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
    const reason = await actionDialog.ask({
      title: "結束聊天室",
      message: "結束後雙方都不能再傳送新訊息或圖片，既有紀錄會保持唯讀；之後仍可從商品頁重新建立聊天室。",
      inputLabel: "結束原因（選填）",
      confirmLabel: "確認結束",
      danger: true,
    });
    if (reason === null) return;
    const { error: closeError } = await supabase.rpc("close_conversation", {
      target_conversation_id: conversation.id,
      reason: reason.trim(),
    });
    if (closeError) setError(closeError.message);
    else onChanged();
  }

  async function hideChat() {
    const confirmed = await actionDialog.ask({
      title: "從清單移除聊天室",
      message: "這只會從你的清單隱藏已結束的聊天室；另一位使用者仍可保留自己的紀錄，必要的交易與安全紀錄也不會被刪除。",
      confirmLabel: "確認移除",
      danger: true,
    });
    if (confirmed === null) return;
    onHide();
  }

  async function blockUser() {
    if (!supabase) return;
    const confirmed = await actionDialog.ask({
      title: "封鎖使用者",
      message: "封鎖後雙方不能再傳送新訊息或圖片；既有交易與聊天室紀錄仍會保留，之後可由平台支援協助處理爭議。",
      confirmLabel: "確認封鎖",
      danger: true,
    });
    if (confirmed === null) return;
    const { error: blockError } = await supabase.rpc("set_user_block", {
      target_user_id: otherUserId,
      should_block: true,
    });
    if (blockError) setError(blockError.message);
    else onChanged();
  }

  async function reportChat(messageId?: string) {
    if (!supabase) return;
    const details = (await actionDialog.ask({
      title: messageId ? "檢舉這則訊息" : "檢舉聊天室",
      message: "檢舉會交由管理員審查；請描述具體情況，避免放入密碼、驗證碼或其他不必要的個資。",
      inputLabel: "檢舉說明",
      inputPlaceholder: "請至少輸入 2 個字",
      minLength: 2,
      confirmLabel: "送出檢舉",
      danger: true,
    }))?.trim();
    if (!details) return;
    const { error: reportError } = await supabase.rpc("submit_chat_report", {
      target_conversation_id: conversation.id,
      target_message_id: messageId || null,
      report_reason: "other",
      report_details: details,
    });
    setError(reportError ? reportError.message : "檢舉已送出，管理員將進行審查");
  }

  function applyQuickPhrase(phrase: string) {
    setDraft(phrase);
  }

  async function respondFromChat(status: "accepted" | "rejected") {
    if (!request) return;
    setSafetyMenuOpen(false);
    await onRespondToRequest(request.id, status);
  }

  const contextLabel = book ? listingContextLabel(book) : "";

  return (
    <div className="trade-chat">
      <div className="trade-chat-head">
        <button className="chat-mobile-back" type="button" onClick={onBack}><ArrowLeft size={17} />返回聊聊</button>
        <div className="trade-chat-person"><b>{senderName(otherUserId)}</b><small>每則最多 5 張圖片、每張 5MB；請勿傳送密碼、驗證碼或其他敏感資料。</small></div>
        <div className="trade-chat-actions chat-safety-actions">
          <button
            className="chat-safety-toggle"
            type="button"
            aria-label="更多聊天室操作"
            aria-expanded={safetyMenuOpen}
            onClick={() => setSafetyMenuOpen((open) => !open)}
          >
            <Ellipsis size={18} />
          </button>
          {safetyMenuOpen && (
            <div className="chat-safety-menu">
              <button type="button" onClick={() => { setSafetyMenuOpen(false); void reportChat(); }}><Flag size={14} />檢舉聊天室</button>
              <button type="button" onClick={() => { setSafetyMenuOpen(false); void blockUser(); }}><Ban size={14} />封鎖對方</button>
              {conversation.status === "active" && (
                <button type="button" onClick={() => { setSafetyMenuOpen(false); void closeChat(); }}><X size={14} />結束聊天室</button>
              )}
              {conversation.status === "closed" && (
                <button type="button" onClick={() => { setSafetyMenuOpen(false); void hideChat(); }}><Trash2 size={14} />隱藏聊天室</button>
              )}
            </div>
          )}
        </div>
      </div>
      {book && (
        <div className="chat-context-card">
          <button className="chat-context-main" type="button" onClick={() => onOpenBook(book.id)}>
            <img src={book.imageUrl} alt="" />
            <span>
              <small>正在詢問</small>
              <b>{book.title}</b>
              <em>{[contextLabel, money(book.price)].filter(Boolean).join(" · ")}</em>
            </span>
          </button>
          {request ? (
            <div className="chat-order-status">
              <span className={`request-status ${request.status}`}>{requestLabels[request.status]}</span>
              <p>{isSeller ? `${senderName(request.buyerId)} 已送出購買意願` : "你已送出購買意願"}</p>
              <RequestCoordinationPanel request={request} viewer={isSeller ? "seller" : "buyer"} />
              {canEditRequestFromChat && (
                <button type="button" className="chat-inline-edit" onClick={onEditRequest}>
                  <Pencil size={14} />
                  修改面交資訊
                </button>
              )}
              {canRespondToRequest && (
                <div className="chat-order-actions">
                  <button className="accept" type="button" disabled={currentUser.accountStatus === "suspended"} onClick={() => void respondFromChat("accepted")}><Check size={15} />接受</button>
                  <button type="button" disabled={currentUser.accountStatus === "suspended"} onClick={() => void respondFromChat("rejected")}><X size={15} />婉拒</button>
                </div>
              )}
            </div>
          ) : (
            <button className="chat-context-link" type="button" onClick={() => onOpenBook(book.id)}>查看商品</button>
          )}
        </div>
      )}
      <div className="trade-chat-log-wrap">
      <div className="trade-chat-log" ref={logRef} onScroll={updateStickToBottom}>
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
                  {canRecallTradeMessage(message, currentUserId, messageActionNow)
                    && <button type="button" onClick={() => void recall(message.id)}>收回</button>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {hasUnreadBelow && (
        <button type="button" className="chat-new-message-button" onClick={scrollToLatestMessage}>
          新訊息
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
      </div>
      {showQuickPhrases && (
        <div className="trade-chat-phrases">
          <small>常用語句</small>
          <div className="trade-chat-phrases-scroll">{CHAT_PHRASES.map((phrase) => <button type="button" key={phrase} onClick={() => applyQuickPhrase(phrase)}>{phrase}</button>)}</div>
        </div>
      )}
      {conversation.status === "active" ? (
        <form className="trade-chat-compose" onSubmit={(event) => void submitMessage(event)}>
          <label className="chat-image-picker" title="加入圖片">
            <ImagePlus size={18} />
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="加入聊天圖片" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          <textarea
            ref={draftInputRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="輸入訊息..."
            maxLength={500}
            aria-label="輸入聊天訊息"
          />
          <button type="submit" disabled={(!draft.trim() && files.length === 0) || sending}>{sending ? "傳送中" : "送出"}</button>
          {files.length > 0 && <small className="selected-images">已選擇 {files.length} 張圖片</small>}
        </form>
      ) : <p className="chat-readonly">這個聊天室已結束，紀錄保持唯讀。你可從書籍頁重新建立聊天室。</p>}
      {enlargedImageUrl && (
        <NativeDialog className="chat-image-lightbox" label="放大的聊聊圖片" onClose={() => setEnlargedImageUrl(null)}>
          <button type="button" className="chat-image-lightbox-close" onClick={() => setEnlargedImageUrl(null)} aria-label="關閉圖片">
            <X size={24} />
          </button>
          <button
            type="button"
            className="chat-image-lightbox-image"
            aria-label="放大的聊聊圖片"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <img src={enlargedImageUrl} alt="" />
          </button>
        </NativeDialog>
      )}
      {actionDialog.dialog && (
        <ActionDialog
          key={actionDialog.dialog.id}
          request={actionDialog.dialog}
          onCancel={actionDialog.cancel}
          onConfirm={actionDialog.confirm}
        />
      )}
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

function EmptyDashboard({ text }: { text: string }) {
  return <div className="empty small"><Clock3 size={34} /><h3>{text}</h3><p>新的進度會出現在這裡。</p></div>;
}
