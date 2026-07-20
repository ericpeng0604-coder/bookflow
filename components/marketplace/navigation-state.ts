import { useCallback, useEffect, useRef, useState } from "react";

import type { Conversation, ListingType, Profile } from "@/lib/types";

export type MarketplaceView = "home" | "book" | "dashboard" | "chat" | "admin";
export type DashboardTab = "listings" | "chats" | "requests" | "received" | "confirmedOrders" | "favorites" | "studentVerification";
export type AdminWorkspace = "overview" | "listings" | "reports" | "feedback" | "studentVerification" | "risk" | "hiddenListings" | "permissions";

const dashboardTabs = new Set<DashboardTab>(["listings", "chats", "requests", "received", "confirmedOrders", "favorites", "studentVerification"]);
const adminWorkspaces = new Set<AdminWorkspace>(["overview", "listings", "reports", "feedback", "studentVerification", "risk", "hiddenListings", "permissions"]);

type RouteHandlers = {
  onListingTypeChange: (listingType: ListingType) => void;
  onBookRouteChange: () => void;
  onConversationRoute: (conversationId: string) => void | Promise<void>;
};

type UseMarketplaceNavigationOptions = RouteHandlers & {
  ready: boolean;
  listingType: ListingType;
  currentUser: Profile | null;
  conversations: Conversation[];
  lastChatStorageKey: (userId: string) => string;
};

type BuildMarketplaceUrlOptions = {
  listingType: ListingType;
  view: MarketplaceView;
  selectedId: string | null;
  currentUser: Profile | null;
  dashboardTab: DashboardTab;
  adminWorkspace: AdminWorkspace;
  expandedConversationId: string | null;
};

export function isDashboardTab(value: string | null): value is DashboardTab {
  return dashboardTabs.has(value as DashboardTab);
}

export function isAdminWorkspace(value: string | null): value is AdminWorkspace {
  return adminWorkspaces.has(value as AdminWorkspace);
}

export function buildChatUrl(listingType: ListingType, conversationId?: string | null) {
  const params = new URLSearchParams();
  params.set("market", listingType);
  params.set("view", "chat");
  params.set("tab", "chats");
  if (conversationId) params.set("conversation", conversationId);
  return `/?${params.toString()}`;
}

export function buildMarketplaceUrl({
  listingType,
  view,
  selectedId,
  currentUser,
  dashboardTab,
  adminWorkspace,
  expandedConversationId,
}: BuildMarketplaceUrlOptions) {
  const params = new URLSearchParams();
  params.set("market", listingType);
  if (view === "book" && selectedId) {
    params.set("view", "book");
    params.set("book", selectedId);
  } else if (view === "chat" && currentUser) {
    return buildChatUrl(listingType, expandedConversationId);
  } else if (view === "dashboard" && currentUser) {
    if (dashboardTab === "chats") {
      return buildChatUrl(listingType, expandedConversationId);
    }
    params.set("view", "dashboard");
    params.set("tab", dashboardTab);
  } else if (view === "admin" && currentUser) {
    params.set("view", "admin");
    params.set("adminTab", adminWorkspace);
  }
  return `/?${params.toString()}`;
}

export function useMarketplaceNavigation({
  ready,
  listingType,
  currentUser,
  conversations,
  lastChatStorageKey,
  onListingTypeChange,
  onBookRouteChange,
  onConversationRoute,
}: UseMarketplaceNavigationOptions) {
  const [view, setView] = useState<MarketplaceView>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("listings");
  const [adminWorkspace, setAdminWorkspace] = useState<AdminWorkspace>("overview");
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const skipNextUrlWriteRef = useRef(false);
  const previousViewRef = useRef<MarketplaceView>("home");
  const handlersRef = useRef<RouteHandlers>({
    onListingTypeChange,
    onBookRouteChange,
    onConversationRoute,
  });

  useEffect(() => {
    handlersRef.current = {
      onListingTypeChange,
      onBookRouteChange,
      onConversationRoute,
    };
  }, [onBookRouteChange, onConversationRoute, onListingTypeChange]);

  const applyCurrentRoute = useCallback((options?: { openConversation?: boolean }) => {
    const params = new URLSearchParams(window.location.search);
    const targetMarket = params.get("market");
    const routeListingType = targetMarket === "book" || targetMarket === "secondhand" ? targetMarket : listingType;
    if (targetMarket === "book" || targetMarket === "secondhand") {
      handlersRef.current.onListingTypeChange(targetMarket);
    }

    const targetView = params.get("view");
    const targetBook = params.get("book");
    if (targetView === "book" && targetBook) {
      setSelectedId(targetBook);
      handlersRef.current.onBookRouteChange();
      setView("book");
      return;
    }

    if (targetView === "chat") {
      if (!currentUser) return;
      const targetConversation = params.get("conversation");
      setDashboardTab("chats");
      setExpandedConversationId(targetConversation);
      setView("chat");
      const canonicalUrl = buildChatUrl(routeListingType, targetConversation);
      if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) {
        window.history.replaceState({}, "", canonicalUrl);
      }
      if (targetConversation && options?.openConversation) {
        void handlersRef.current.onConversationRoute(targetConversation);
      }
      return;
    }

    if (targetView === "dashboard") {
      if (!currentUser) return;
      const targetTab = params.get("tab");
      if (targetTab === "chats") {
        const targetConversation = params.get("conversation");
        setDashboardTab("chats");
        setExpandedConversationId(targetConversation);
        setView("chat");
        const canonicalUrl = buildChatUrl(routeListingType, targetConversation);
        if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) {
          window.history.replaceState({}, "", canonicalUrl);
        }
        if (targetConversation && options?.openConversation) {
          void handlersRef.current.onConversationRoute(targetConversation);
        }
        return;
      }
      setView("dashboard");
      if (isDashboardTab(targetTab)) setDashboardTab(targetTab);
      setExpandedConversationId(null);
      return;
    }

    if (targetView === "admin") {
      if (!currentUser || !["admin", "moderator"].includes(currentUser.role)) return;
      setView("admin");
      const targetWorkspace = params.get("adminTab");
      if (isAdminWorkspace(targetWorkspace)) setAdminWorkspace(targetWorkspace);
      return;
    }

    setSelectedId(null);
    handlersRef.current.onBookRouteChange();
    setView("home");
  }, [currentUser, listingType]);

  useEffect(() => {
    if (!ready) return;
    skipNextUrlWriteRef.current = true;
    applyCurrentRoute({ openConversation: true });
  }, [applyCurrentRoute, ready]);

  useEffect(() => {
    if (!ready) return;
    const restorePublicNavigation = () => applyCurrentRoute();
    window.addEventListener("popstate", restorePublicNavigation);
    return () => window.removeEventListener("popstate", restorePublicNavigation);
  }, [applyCurrentRoute, ready]);

  useEffect(() => {
    if (!ready) return;
    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }
    const nextUrl = buildMarketplaceUrl({
      listingType,
      view,
      selectedId,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    });
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [adminWorkspace, currentUser, dashboardTab, expandedConversationId, listingType, ready, selectedId, view]);

  useEffect(() => {
    if (view === "dashboard" && previousViewRef.current !== "dashboard") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    previousViewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (view !== "dashboard" || dashboardTab !== "chats" || expandedConversationId || !currentUser) return;
    const lastChatId = window.localStorage.getItem(lastChatStorageKey(currentUser.id));
    if (!lastChatId || !conversations.some((conversation) => conversation.id === lastChatId)) return;
    setExpandedConversationId(lastChatId);
  }, [conversations, currentUser, dashboardTab, expandedConversationId, lastChatStorageKey, view]);

  const openBookRoute = useCallback((bookId: string, market: ListingType) => {
    setSelectedId(bookId);
    handlersRef.current.onBookRouteChange();
    setView("book");
    window.history.pushState({}, "", buildMarketplaceUrl({
      listingType: market,
      view: "book",
      selectedId: bookId,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [adminWorkspace, currentUser, dashboardTab, expandedConversationId]);

  const returnToMarketRoute = useCallback(() => {
    setSelectedId(null);
    handlersRef.current.onBookRouteChange();
    setView("home");
    window.history.pushState({}, "", buildMarketplaceUrl({
      listingType,
      view: "home",
      selectedId: null,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    }));
  }, [adminWorkspace, currentUser, dashboardTab, expandedConversationId, listingType]);

  const returnToChatListRoute = useCallback(() => {
    setExpandedConversationId(null);
    setDashboardTab("chats");
    setView("chat");
    window.history.pushState({}, "", buildChatUrl(listingType));
  }, [listingType]);

  const openChatRoute = useCallback((conversationId?: string | null) => {
    setDashboardTab("chats");
    setExpandedConversationId(conversationId || null);
    setView("chat");
    window.history.pushState({}, "", buildChatUrl(listingType, conversationId));
  }, [listingType]);

  const openDashboard = useCallback(() => {
    setView("dashboard");
    setDashboardTab("listings");
    setExpandedConversationId(null);
  }, []);

  return {
    dashboardTab,
    adminWorkspace,
    expandedConversationId,
    openChatRoute,
    openBookRoute,
    openDashboard,
    returnToChatListRoute,
    returnToMarketRoute,
    selectedId,
    setDashboardTab,
    setAdminWorkspace,
    setExpandedConversationId,
    setSelectedId,
    setView,
    view,
  };
}
