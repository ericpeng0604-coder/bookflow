import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardTab } from "@/components/marketplace/navigation-state";
import {
  fetchRiskProfilesForModeration,
  loadModerationData,
  loadWorkspaceTabData,
  type ConversationPage,
  type RiskModerationCursor,
  type RiskModerationFilters,
} from "@/lib/marketplace/queries";
import { isAbortError, runGuarded } from "@/lib/marketplace/refresh-guard";
import type {
  Book,
  Conversation,
  Feedback,
  Profile,
  PurchaseRequest,
  Report,
  RiskPolicy,
  RiskProfile,
  SellerLifecycle,
  StudentVerification,
  StudentVerificationSummary,
  TradeContact,
  TrustBadge,
  PurchaseOrder,
} from "@/lib/types";

type WorkspaceCallbacks = {
  onRequestsLoaded: (requests: PurchaseRequest[], user: Profile) => void;
  onOrdersLoaded: (orders: PurchaseOrder[], user: Profile) => void;
  onProfilesLoaded: (profiles: Profile[], user: Profile) => void;
  onAdminProfilesLoaded: (profiles: Profile[]) => void;
  onConversationsLoaded: (conversations: Conversation[]) => void;
  onConversationPageLoaded: (page: ConversationPage) => void;
  onToast: (message: string) => void;
  onAdminVerificationExpired?: (message: string, user: Profile) => Promise<boolean>;
};

export type UseMarketplaceWorkspaceOptions = WorkspaceCallbacks & {
  client: SupabaseClient | null;
  currentUser: Profile | null;
  dashboardTab: DashboardTab;
  reloadMarketplace: () => Promise<void>;
};

export function useMarketplaceWorkspace({
  client,
  currentUser,
  dashboardTab,
  reloadMarketplace,
  onRequestsLoaded,
  onOrdersLoaded,
  onProfilesLoaded,
  onAdminProfilesLoaded,
  onConversationsLoaded,
  onConversationPageLoaded,
  onToast,
  onAdminVerificationExpired,
}: UseMarketplaceWorkspaceOptions) {
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [requestBooks, setRequestBooks] = useState<Book[]>([]);
  const [contacts, setContacts] = useState<Record<string, TradeContact>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoriteBookCache, setFavoriteBookCache] = useState<Book[]>([]);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>([]);
  const [verifiedPartyIds, setVerifiedPartyIds] = useState<Set<string>>(() => new Set());
  const [sellerLifecycle, setSellerLifecycle] = useState<SellerLifecycle | null>(null);
  const [myStudentVerification, setMyStudentVerification] = useState<StudentVerificationSummary | null>(null);
  const [pendingReviews, setPendingReviews] = useState<Book[]>([]);
  const [hiddenBooks, setHiddenBooks] = useState<Book[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [riskProfiles, setRiskProfiles] = useState<RiskProfile[]>([]);
  const [riskCursor, setRiskCursor] = useState<RiskModerationCursor>(null);
  const [riskHasMore, setRiskHasMore] = useState(false);
  const [riskTotalCount, setRiskTotalCount] = useState(0);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy | null>(null);
  const [studentVerifications, setStudentVerifications] = useState<StudentVerification[]>([]);

  const appendRequestBooks = useCallback((books: Book[]) => {
    setRequestBooks((previous) => [
      ...new Map([...previous, ...books].map((book) => [book.id, book])).values(),
    ]);
  }, []);

  const replaceFavoriteIds = useCallback((ids: Iterable<string>) => {
    setFavoriteIds(new Set(ids));
  }, []);

  const updateFavoriteIds = useCallback((update: (previous: Set<string>) => Set<string>) => {
    setFavoriteIds(update);
  }, []);

  const mergeTrustBadges = useCallback((badges: TrustBadge[]) => {
    setTrustBadges((previous) => [
      ...previous.filter((badge) => !badges.some((item) => item.userId === badge.userId && item.badgeType === badge.badgeType)),
      ...badges,
    ]);
  }, []);

  const loadUserWorkspace = useCallback(async (user: Profile, tab: DashboardTab) => {
    if (!client) return;
    await runGuarded(`workspace:${tab}`, async (signal) => {
      try {
        const workspace = await loadWorkspaceTabData(client, tab);
        if (signal.aborted) return;
        if (workspace.myBooks) setMyBooks(workspace.myBooks);
        if (workspace.requestBooks) {
          appendRequestBooks(workspace.requestBooks);
          if (tab === "favorites") setFavoriteBookCache(workspace.requestBooks);
        }
        if (workspace.requests) onRequestsLoaded(workspace.requests, user);
        if (workspace.orders) onOrdersLoaded(workspace.orders, user);
        if (workspace.partyProfiles) onProfilesLoaded(workspace.partyProfiles, user);
        if (workspace.contacts) setContacts(workspace.contacts);
        if (workspace.trustBadges) mergeTrustBadges(workspace.trustBadges);
        if (workspace.verifiedPartyIds) setVerifiedPartyIds(new Set(workspace.verifiedPartyIds));
        if (workspace.sellerLifecycle !== undefined) setSellerLifecycle(workspace.sellerLifecycle);
        if (workspace.studentVerification !== undefined) setMyStudentVerification(workspace.studentVerification);
        if (workspace.conversationPage) onConversationPageLoaded(workspace.conversationPage);
        else if (workspace.conversations) onConversationsLoaded(workspace.conversations);
        if (workspace.favoriteIds) replaceFavoriteIds(workspace.favoriteIds);
      } catch (error) {
        if (!isAbortError(error)) {
          onToast(`霈?漱???仃??${error instanceof Error ? error.message : "?芰?航炊"}`);
        }
      }
    });
  }, [appendRequestBooks, client, mergeTrustBadges, onConversationPageLoaded, onConversationsLoaded, onOrdersLoaded, onProfilesLoaded, onRequestsLoaded, onToast, replaceFavoriteIds]);

  const loadDashboardWorkspace = useCallback(async (user: Profile, tab: DashboardTab) => {
    const tabs = tab === "requests" || tab === "received" || tab === "chats" || tab === "studentVerification"
      ? [tab]
      : [tab, "requests" as const];
    await Promise.all(tabs.map((targetTab) => loadUserWorkspace(user, targetTab)));
  }, [loadUserWorkspace]);

  const loadModerationPanel = useCallback(async (user: Profile) => {
    if (!client) return;
    await runGuarded("moderation", async (signal) => {
      try {
        const data = await loadModerationData(client, user);
        if (signal.aborted) return;
        setPendingReviews(data.pendingReviews);
        setHiddenBooks(data.hiddenBooks);
        setReports(data.reports);
        setFeedback(data.feedback);
        setStudentVerifications(data.studentVerifications);
        setRiskProfiles(data.riskPage.profiles);
        setRiskCursor(data.riskPage.nextCursor);
        setRiskHasMore(data.riskPage.hasMore);
        setRiskTotalCount(data.riskPage.totalCount);
        setRiskPolicy(data.riskPolicy);
        if (data.adminProfiles.length > 0) onAdminProfilesLoaded(data.adminProfiles);
      } catch (error) {
        if (await onAdminVerificationExpired?.(error instanceof Error ? error.message : "", user)) return;
        if (!isAbortError(error)) {
          onToast(`霈?祟?貉??仃??${error instanceof Error ? error.message : "?芰?航炊"}`);
        }
      }
    });
  }, [client, onAdminProfilesLoaded, onAdminVerificationExpired, onToast]);

  const loadRiskProfiles = useCallback(async (filters: RiskModerationFilters, append = false) => {
    if (!client || !currentUser || riskLoading) return;
    setRiskLoading(true);
    try {
      const page = await fetchRiskProfilesForModeration(client, filters, append ? riskCursor : null);
      setRiskProfiles((previous) => {
        if (!append) return page.profiles;
        return [...new Map([...previous, ...page.profiles].map((profile) => [profile.userId, profile])).values()];
      });
      setRiskCursor(page.nextCursor);
      setRiskHasMore(page.hasMore);
      if (!append || page.totalCount > 0) setRiskTotalCount(page.totalCount);
    } catch (error) {
      if (await onAdminVerificationExpired?.(error instanceof Error ? error.message : "", currentUser)) return;
      if (!isAbortError(error)) onToast(`風險佇列載入失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setRiskLoading(false);
    }
  }, [client, currentUser, onAdminVerificationExpired, onToast, riskCursor, riskLoading]);

  const loadMoreRiskProfiles = useCallback(async (filters: RiskModerationFilters) => {
    if (!riskHasMore) return;
    await loadRiskProfiles(filters, true);
  }, [loadRiskProfiles, riskHasMore]);

  const reloadAfterUserMutation = useCallback(async () => {
    if (!currentUser) return;
    await Promise.all([loadDashboardWorkspace(currentUser, dashboardTab), reloadMarketplace()]);
  }, [currentUser, dashboardTab, loadDashboardWorkspace, reloadMarketplace]);

  const reloadAfterModerationMutation = useCallback(async () => {
    if (!currentUser) return;
    await Promise.all([loadModerationPanel(currentUser), reloadMarketplace()]);
  }, [currentUser, loadModerationPanel, reloadMarketplace]);

  const clearWorkspace = useCallback(() => {
    setMyBooks([]);
    setRequestBooks([]);
    setContacts({});
    setFavoriteBookCache([]);
    setFavoriteIds(new Set());
    setTrustBadges([]);
    setVerifiedPartyIds(new Set());
    setSellerLifecycle(null);
    setMyStudentVerification(null);
    setPendingReviews([]);
    setHiddenBooks([]);
    setReports([]);
    setFeedback([]);
    setRiskProfiles([]);
    setRiskCursor(null);
    setRiskHasMore(false);
    setRiskTotalCount(0);
    setRiskLoading(false);
    setRiskPolicy(null);
    setStudentVerifications([]);
  }, []);

  return {
    appendRequestBooks,
    clearWorkspace,
    contacts,
    favoriteBookCache,
    favoriteIds,
    feedback,
    hiddenBooks,
    loadDashboardWorkspace,
    loadModerationPanel,
    loadMoreRiskProfiles,
    loadRiskProfiles,
    loadUserWorkspace,
    mergeTrustBadges,
    myBooks,
    myStudentVerification,
    pendingReviews,
    reports,
    requestBooks,
    reloadAfterModerationMutation,
    reloadAfterUserMutation,
    replaceFavoriteIds,
    riskPolicy,
    riskProfiles,
    riskHasMore,
    riskLoading,
    riskTotalCount,
    sellerLifecycle,
    studentVerifications,
    trustBadges,
    updateFavoriteIds,
    verifiedPartyIds,
  };
}
