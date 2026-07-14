import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceFilters } from "@/lib/marketplace/filters";
import { rankImageSearchResults, type ImageSearchPlan, type ImageSearchResult } from "@/lib/marketplace/image-search";
import {
  mapAdminProfile,
  mapBook,
  mapNotification,
  mapPartyProfile,
  mapPublicProfile,
  mapReport,
  mapRequest,
  mapStudentVerification,
  mapStudentVerificationSummary,
  mapTradeContact,
  mapConversation,
  mapFeedback,
  mapRiskPolicy,
  mapRiskProfile,
  mapTrustBadge,
} from "@/lib/marketplace/mappers";
import type { Book, Conversation, Feedback, Profile, PurchaseRequest, RiskPolicy, RiskProfile, SellerLifecycle, StudentVerification, StudentVerificationSummary, TradeContact, TradeReviewTag, TrustBadge } from "@/lib/types";

export const MARKETPLACE_PAGE_SIZE = 24;

export type { MarketplaceFilters } from "@/lib/marketplace/filters";
export type MarketplaceCursor = {
  sellerVerified: boolean;
  createdAt: string;
  id: string;
} | null;

export type MarketplacePageResult = {
  books: Book[];
  hasMore: boolean;
  nextCursor: MarketplaceCursor;
};

function marketplaceRpcParams(filters: MarketplaceFilters, limit: number, cursor: MarketplaceCursor) {
  return {
    p_limit: limit + 1,
    p_cursor_verified: cursor?.sellerVerified ?? null,
    p_cursor_created: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_listing_type: filters.listingType,
    p_item_category: filters.itemCategory,
    p_department: filters.department,
    p_min_price: filters.minPrice,
    p_max_price: filters.maxPrice,
    p_query: filters.query,
  };
}

export async function fetchMarketplacePage(
  client: SupabaseClient,
  filters: MarketplaceFilters,
  cursor: MarketplaceCursor,
): Promise<MarketplacePageResult> {
  const { data: rows, error } = await client.rpc(
    "list_books_page",
    marketplaceRpcParams(filters, MARKETPLACE_PAGE_SIZE, cursor),
  );
  if (error) throw error;

  const mapped = (rows ?? []).map((row: Record<string, unknown>) => mapBook(row));
  const hasMore = mapped.length > MARKETPLACE_PAGE_SIZE;
  const books = hasMore ? mapped.slice(0, MARKETPLACE_PAGE_SIZE) : mapped;
  const lastBook = books.at(-1);

  return {
    books,
    hasMore,
    nextCursor: lastBook
      ? { sellerVerified: lastBook.sellerVerified, createdAt: lastBook.createdAt, id: lastBook.id }
      : null,
  };
}

async function addSellerVerificationFlags(client: SupabaseClient, books: Book[]) {
  if (books.length === 0) return books;
  const sellerIds = [...new Set(books.map((book) => book.sellerId))];
  const { data, error } = await client.rpc("get_public_student_verification_status", {
    target_user_ids: sellerIds,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) return books;
    throw error;
  }
  const verifiedIds = new Set(
    (data ?? [])
      .filter((row: Record<string, unknown>) => Boolean(row.seller_verified))
      .map((row: Record<string, unknown>) => String(row.user_id)),
  );
  return books.map((book) => ({ ...book, sellerVerified: verifiedIds.has(book.sellerId) }));
}

export async function fetchImageSearchCandidates(
  client: SupabaseClient,
  filters: MarketplaceFilters,
  plan: ImageSearchPlan,
): Promise<ImageSearchResult[]> {
  const booksById = new Map<string, Book>();
  const searchFilters: MarketplaceFilters = {
    ...filters,
    listingType: "book",
    itemCategory: null,
    query: "",
  };

  for (const query of plan.candidateQueries) {
    const { data: rows, error } = await client.rpc(
      "list_books_page",
      marketplaceRpcParams({ ...searchFilters, query }, MARKETPLACE_PAGE_SIZE, null),
    );
    if (error) throw error;
    for (const row of rows ?? []) {
      const book = mapBook(row as Record<string, unknown>);
      booksById.set(book.id, book);
    }
  }

  return rankImageSearchResults([...booksById.values()], plan)
    .sort((left, right) => Number(right.book.sellerVerified) - Number(left.book.sellerVerified))
    .slice(0, MARKETPLACE_PAGE_SIZE);
}

export async function fetchBookById(client: SupabaseClient, bookId: string) {
  const { data, error } = await client.from("books").select("*").eq("id", bookId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await addSellerVerificationFlags(client, [mapBook(data)]))[0] ?? null;
}

export async function fetchBooksByIds(client: SupabaseClient, bookIds: string[]) {
  if (bookIds.length === 0) return [] as Book[];
  const { data, error } = await client.from("books").select("*").in("id", bookIds);
  if (error) throw error;
  return addSellerVerificationFlags(client, (data ?? []).map((row) => mapBook(row)));
}

export async function fetchProfilesByIds(client: SupabaseClient, profileIds: string[]) {
  if (profileIds.length === 0) return [] as Profile[];
  const { data, error } = await client.rpc("get_profiles_by_ids", { p_ids: profileIds });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, string>) => mapPublicProfile(row));
}

export async function fetchMyBooks(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_books");
  if (error) throw error;
  const books: Book[] = await addSellerVerificationFlags(
    client,
    (data ?? []).map((row: Record<string, unknown>) => mapBook(row)),
  );
  if (books.length === 0) return books;

  const { data: preferences, error: preferenceError } = await client
    .from("book_contact_preferences")
    .select("book_id,method,value")
    .in("book_id", books.map((book) => book.id));
  if (preferenceError) {
    if (["PGRST205", "42P01"].includes(preferenceError.code || "")) return books;
    throw preferenceError;
  }

  const preferenceMap = new Map(
    (preferences ?? []).map((row) => [
      String(row.book_id),
      {
        contactMethod: String(row.method || "none") as Book["contactMethod"],
        contactValue: String(row.value || ""),
      },
    ]),
  );
  return books.map((book) => ({ ...book, ...preferenceMap.get(book.id) }));
}

export async function fetchPendingReviews(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_pending_reviews_page", {
    p_limit: 100,
    p_cursor_created: null,
    p_cursor_id: null,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapBook(row));
}

export async function fetchHiddenBooks(client: SupabaseClient) {
  const { data, error } = await client
    .from("books")
    .select("*")
    .eq("moderation_visibility", "hidden")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => mapBook(row));
}

export async function fetchUserRequests(client: SupabaseClient, limit = 50) {
  const { data, error } = await client
    .from("purchase_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapRequest(row));
}

export async function fetchActiveRequestForBook(
  client: SupabaseClient,
  bookId: string,
  buyerId: string,
): Promise<PurchaseRequest | null> {
  const { data, error } = await client
    .from("purchase_requests")
    .select("*")
    .eq("book_id", bookId)
    .eq("buyer_id", buyerId)
    .in("status", ["pending", "waitlisted", "reserved", "awaiting_confirmation", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRequest(data) : null;
}

export async function fetchNotifications(client: SupabaseClient) {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => mapNotification(row));
}

export async function fetchUnreadNotificationCount(client: SupabaseClient) {
  const { data, error } = await client.rpc("count_my_unread_notifications");
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) {
      const fallback = await fetchNotifications(client);
      return fallback.filter((notification) => !notification.readAt).length;
    }
    throw error;
  }
  return Number(data || 0);
}

export async function fetchConversations(client: SupabaseClient): Promise<Conversation[]> {
  let { data, error } = await client.rpc("list_my_conversations_page", {
    p_limit: 30,
    p_cursor_last_message_at: null,
    p_cursor_id: null,
  });
  if (error && ["PGRST202", "42883"].includes(error.code || "")) {
    const fallback = await client.rpc("list_my_conversations");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) return [] as Conversation[];
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapConversation(row));
}

export async function fetchFavoriteIds(client: SupabaseClient, limit = 100) {
  const { data, error } = await client
    .from("favorites")
    .select("book_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (["PGRST205", "42P01"].includes(error.code || "")) return [] as string[];
    throw error;
  }
  return (data ?? []).map((row) => String(row.book_id));
}

export async function fetchSellerLifecycle(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_seller_lifecycle");
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) return null;
    throw error;
  }
  const row = data?.[0];
  if (!row) return null;
  return {
    lastActiveAt: String(row.last_active_at),
    listingsConfirmedAt: String(row.listings_confirmed_at),
    firstListingNoticeAt: row.first_listing_notice_at ? String(row.first_listing_notice_at) : null,
  } satisfies SellerLifecycle;
}

export async function fetchPartyProfiles(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_request_party_profiles");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, string>) => mapPartyProfile(row));
}

export async function fetchAdminProfiles(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_profiles_for_admin");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, string>) => mapAdminProfile(row));
}

export async function fetchModerationReports(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_reports_for_moderation");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapReport(row));
}

export async function fetchFeedbackForModeration(client: SupabaseClient): Promise<Feedback[]> {
  const { data, error } = await client.rpc("list_feedback_for_moderation");
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) return [];
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapFeedback(row));
}

export async function fetchPublicTrustBadges(client: SupabaseClient, userIds: string[]): Promise<TrustBadge[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await client.rpc("get_public_trust_badges", { target_user_ids: userIds.slice(0, 100) });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapTrustBadge(row));
}

export async function fetchMyReviewStatus(client: SupabaseClient, requestId: string) {
  const { data, error } = await client.rpc("get_my_review_status", { target_request_id: requestId });
  if (error) throw error;
  const row = data?.[0] as Record<string, unknown> | undefined;
  return row ? {
    reviewed: Boolean(row.reviewed),
    revieweeId: String(row.reviewee_id),
    revieweeName: String(row.reviewee_name || "使用者"),
  } : null;
}

export async function submitTradeReview(
  client: SupabaseClient,
  requestId: string,
  rating: number,
  tags: TradeReviewTag[],
  comment: string,
) {
  const { data, error } = await client.rpc("submit_trade_review", {
    target_request_id: requestId,
    review_rating: rating,
    review_tags: tags,
    review_comment: comment,
  });
  if (error) throw error;
  return String(data);
}

export async function fetchRiskProfilesForModeration(client: SupabaseClient): Promise<RiskProfile[]> {
  const { data, error } = await client.rpc("list_risk_profiles_for_moderation");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapRiskProfile(row));
}

export async function fetchRiskPolicy(client: SupabaseClient): Promise<RiskPolicy | null> {
  const { data, error } = await client.rpc("get_risk_policy");
  if (error) throw error;
  const row = data?.[0] as Record<string, unknown> | undefined;
  return row ? mapRiskPolicy(row) : null;
}

export async function fetchStudentVerificationsForReview(client: SupabaseClient): Promise<StudentVerification[]> {
  const { data, error } = await client.rpc("list_student_verifications_for_review");
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code || "")) return [];
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapStudentVerification(row));
}

export async function fetchMyStudentVerification(client: SupabaseClient): Promise<StudentVerificationSummary | null> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;
  const { data, error } = await client
    .from("student_verifications")
    .select("id,status,program_type,admission_year,department_code,class_code,review_note,reviewed_at,created_at")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapStudentVerificationSummary(data) : null;
}

export async function fetchTradeContactsBatch(client: SupabaseClient, requestIds: string[]) {
  if (requestIds.length === 0) return {} as Record<string, TradeContact>;

  const { data, error } = await client.rpc("get_trade_contacts_batch", {
    p_request_ids: requestIds,
  });
  if (error) throw error;

  const contacts: Record<string, TradeContact> = {};
  for (const row of data ?? []) {
    if (!["email", "line"].includes(String(row.method)) || !String(row.value || "").trim()) {
      continue;
    }
    contacts[String(row.request_id)] = mapTradeContact(row);
  }
  return contacts;
}

export type WorkspaceTabData = {
  myBooks?: Book[];
  requests?: ReturnType<typeof mapRequest>[];
  requestBooks?: Book[];
  partyProfiles?: Profile[];
  contacts?: Record<string, TradeContact>;
  sellerLifecycle?: SellerLifecycle | null;
  conversations?: Conversation[];
  favoriteIds?: string[];
  trustBadges?: TrustBadge[];
  studentVerification?: StudentVerificationSummary | null;
};

export async function loadWorkspaceTabData(
  client: SupabaseClient,
  tab: "listings" | "chats" | "requests" | "received" | "favorites" | "studentVerification",
): Promise<WorkspaceTabData> {
  if (tab === "studentVerification") {
    return { studentVerification: await fetchMyStudentVerification(client) };
  }
  if (tab === "listings") {
    const [myBooks, sellerLifecycle] = await Promise.all([
      fetchMyBooks(client),
      fetchSellerLifecycle(client),
    ]);
    return { myBooks, sellerLifecycle };
  }

  if (tab === "chats") {
    const [conversations, requests] = await Promise.all([
      fetchConversations(client),
      fetchUserRequests(client),
    ]);
    const profileIds = conversations.flatMap((item) => [item.buyerId, item.sellerId]);
    const bookIds = [...new Set(conversations.map((item) => item.bookId))];
    const [partyProfiles, requestBooks] = await Promise.all([
      fetchProfilesByIds(client, [...new Set(profileIds)]),
      fetchBooksByIds(client, bookIds),
    ]);
    const trustBadges = await fetchPublicTrustBadges(client, [...new Set(profileIds)]);
    return { conversations, requests, partyProfiles, requestBooks, trustBadges };
  }

  if (tab === "favorites") {
    const favoriteIds = await fetchFavoriteIds(client);
    const requestBooks = await fetchBooksByIds(client, favoriteIds.slice(0, 100));
    return { favoriteIds, requestBooks };
  }

  const requests = await fetchUserRequests(client);
  const selectedIds = requests
    .filter((request) => ["reserved", "awaiting_confirmation", "completed"].includes(request.status))
    .map((request) => request.id);
  const profileIds = [...new Set(requests.map((request) => request.buyerId))];
  const bookIds = [...new Set(requests.map((request) => request.bookId))];
  const [partyProfiles, contacts, requestBooks] = await Promise.all([
    fetchProfilesByIds(client, profileIds),
    fetchTradeContactsBatch(client, selectedIds),
    fetchBooksByIds(client, bookIds),
  ]);
  const badgeIds = [...new Set([
    ...profileIds,
    ...requestBooks.map((book) => book.sellerId),
  ])];
  const trustBadges = await fetchPublicTrustBadges(client, badgeIds);
  return { requests, partyProfiles, contacts, requestBooks, trustBadges };
}

export async function loadModerationData(client: SupabaseClient, user: Profile) {
  const [pendingReviews, hiddenBooks, reports, feedback, studentVerifications, riskProfiles, riskPolicy, adminProfiles] = await Promise.all([
    fetchPendingReviews(client),
    fetchHiddenBooks(client),
    fetchModerationReports(client),
    fetchFeedbackForModeration(client),
    fetchStudentVerificationsForReview(client),
    fetchRiskProfilesForModeration(client),
    user.role === "admin" ? fetchRiskPolicy(client) : Promise.resolve(null),
    user.role === "admin" ? fetchAdminProfiles(client) : Promise.resolve([] as Profile[]),
  ]);

  return { pendingReviews, hiddenBooks, reports, feedback, studentVerifications, riskProfiles, riskPolicy, adminProfiles };
}

export function mergeProfiles(
  publicProfiles: Profile[],
  partyProfiles: Profile[],
  adminProfiles: Profile[],
  currentUser: Profile | null,
) {
  const profileMap = new Map(publicProfiles.map((profile) => [profile.id, profile]));
  for (const profile of partyProfiles) profileMap.set(profile.id, profile);
  for (const profile of adminProfiles) profileMap.set(profile.id, profile);
  if (currentUser) profileMap.set(currentUser.id, currentUser);
  return [...profileMap.values()];
}

export type ModerationData = Awaited<ReturnType<typeof loadModerationData>>;
