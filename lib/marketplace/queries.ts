import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceFilters } from "@/lib/marketplace/filters";
import {
  mapAdminProfile,
  mapBook,
  mapNotification,
  mapPartyProfile,
  mapPublicProfile,
  mapReport,
  mapRequest,
  mapTradeContact,
  mapConversation,
} from "@/lib/marketplace/mappers";
import type { Book, Conversation, Profile, SellerLifecycle, TradeContact } from "@/lib/types";

export const MARKETPLACE_PAGE_SIZE = 24;

export type { MarketplaceFilters } from "@/lib/marketplace/filters";
export type MarketplaceCursor = {
  createdAt: string;
  id: string;
} | null;

export type MarketplacePageResult = {
  books: Book[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: MarketplaceCursor;
};

function marketplaceRpcParams(filters: MarketplaceFilters, limit: number, cursor: MarketplaceCursor) {
  return {
    p_limit: limit + 1,
    p_cursor_created: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_department: filters.department,
    p_max_price: filters.maxPrice,
    p_query: filters.query,
  };
}

function countRpcParams(filters: MarketplaceFilters) {
  return {
    p_department: filters.department,
    p_max_price: filters.maxPrice,
    p_query: filters.query,
  };
}

export async function fetchMarketplacePage(
  client: SupabaseClient,
  filters: MarketplaceFilters,
  cursor: MarketplaceCursor,
): Promise<MarketplacePageResult> {
  const [{ data: rows, error }, { data: totalCount, error: countError }] = await Promise.all([
    client.rpc("list_books_page", marketplaceRpcParams(filters, MARKETPLACE_PAGE_SIZE, cursor)),
    client.rpc("count_books_filtered", countRpcParams(filters)),
  ]);

  if (error) throw error;
  if (countError) throw countError;

  const mapped = (rows ?? []).map((row: Record<string, unknown>) => mapBook(row));
  const hasMore = mapped.length > MARKETPLACE_PAGE_SIZE;
  const books = hasMore ? mapped.slice(0, MARKETPLACE_PAGE_SIZE) : mapped;
  const lastBook = books.at(-1);

  return {
    books,
    totalCount: Number(totalCount ?? books.length),
    hasMore,
    nextCursor: lastBook ? { createdAt: lastBook.createdAt, id: lastBook.id } : null,
  };
}

export async function fetchBookById(client: SupabaseClient, bookId: string) {
  const { data, error } = await client.from("books").select("*").eq("id", bookId).maybeSingle();
  if (error) throw error;
  return data ? mapBook(data) : null;
}

export async function fetchBooksByIds(client: SupabaseClient, bookIds: string[]) {
  if (bookIds.length === 0) return [] as Book[];
  const { data, error } = await client.from("books").select("*").in("id", bookIds);
  if (error) throw error;
  return (data ?? []).map((row) => mapBook(row));
}

export async function fetchPublicProfiles(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_public_profiles");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, string>) => mapPublicProfile(row));
}

export async function fetchMyBooks(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_books");
  if (error) throw error;
  const books: Book[] = (data ?? []).map((row: Record<string, unknown>) => mapBook(row));
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

export async function fetchUserRequests(client: SupabaseClient) {
  const { data, error } = await client
    .from("purchase_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => mapRequest(row));
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

export async function fetchConversations(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_conversations");
  if (error) {
    if (["PGRST202", "42883"].includes(error.code || "")) return [] as Conversation[];
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapConversation(row));
}

export async function fetchFavoriteIds(client: SupabaseClient) {
  const { data, error } = await client
    .from("favorites")
    .select("book_id")
    .order("created_at", { ascending: false });
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

export async function loadUserWorkspaceData(client: SupabaseClient, _user: Profile) {
  const requests = await fetchUserRequests(client);
  const selectedIds = requests
    .filter((request) => ["reserved", "awaiting_confirmation", "completed"].includes(request.status))
    .map((request) => request.id);

  const [myBooks, partyProfiles, notifications, contacts, sellerLifecycle, conversations, favoriteIds] = await Promise.all([
    fetchMyBooks(client),
    fetchPartyProfiles(client),
    fetchNotifications(client),
    fetchTradeContactsBatch(client, selectedIds),
    fetchSellerLifecycle(client),
    fetchConversations(client),
    fetchFavoriteIds(client),
  ]);

  const requestBookIds = [...new Set([
    ...requests.map((request) => request.bookId),
    ...conversations.map((conversation: Conversation) => conversation.bookId),
    ...favoriteIds,
  ])];
  const missingBookIds = requestBookIds.filter((bookId) => !myBooks.some((book: Book) => book.id === bookId));
  const requestBooks = missingBookIds.length > 0 ? await fetchBooksByIds(client, missingBookIds) : [];

  return {
    myBooks,
    requests,
    requestBooks,
    partyProfiles,
    notifications,
    contacts,
    sellerLifecycle,
    conversations,
    favoriteIds,
  };
}

export async function loadModerationData(client: SupabaseClient, user: Profile) {
  const [pendingReviews, hiddenBooks, reports, adminProfiles] = await Promise.all([
    fetchPendingReviews(client),
    fetchHiddenBooks(client),
    fetchModerationReports(client),
    user.role === "admin" ? fetchAdminProfiles(client) : Promise.resolve([] as Profile[]),
  ]);

  return { pendingReviews, hiddenBooks, reports, adminProfiles };
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

export type UserWorkspaceData = Awaited<ReturnType<typeof loadUserWorkspaceData>>;
export type ModerationData = Awaited<ReturnType<typeof loadModerationData>>;
