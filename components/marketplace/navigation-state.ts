import { useCallback, useEffect, useRef, useState } from "react";

import type { Conversation, ListingType, Profile } from "@/lib/types";

export type MarketplaceView = "home" | "book" | "dashboard" | "chat" | "admin";
export type DashboardTab = "listings" | "chats" | "requests" | "received" | "confirmedOrders" | "favorites" | "studentVerification";

const dashboardTabs = new Set<DashboardTab>(["listings", "chats", "requests", "received", "confirmedOrders", "favorites", "studentVerification"]);

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
  initialView?: MarketplaceView;
  initialDashboardTab?: DashboardTab;
};

type BuildMarketplaceUrlOptions = {
  listingType: ListingType;
  view: MarketplaceView;
  selectedId: string | null;
  currentUser: Profile | null;
  dashboardTab: DashboardTab;
  expandedConversationId: string | null;
};

export function isDashboardTab(value: string | null): value is DashboardTab {
  return dashboardTabs.has(value as DashboardTab);
}

export function buildMarketplaceUrl({
  listingType,
  view,
  selectedId,
  currentUser,
  dashboardTab,
  expandedConversationId,
}: BuildMarketplaceUrlOptions) {
  const params = new URLSearchParams();
  params.set("market", listingType);
  if (view === "book" && selectedId) {
    params.set("view", "book");
    params.set("book", selectedId);
  } else if (view === "chat" && currentUser) {
    params.set("view", "chat");
    params.set("tab", "chats");
    if (expandedConversationId) {
      params.set("conversation", expandedConversationId);
    }
  } else if (view === "dashboard" && currentUser) {
    params.set("view", "dashboard");
    params.set("tab", dashboardTab);
  }
  return `/?${params.toString()}`;
}

export function useMarketplaceNavigation({
  ready,
  listingType,
  currentUser,
  conversations,
  lastChatStorageKey,
  initialView = "home",
  initialDashboardTab = "listings",
  onListingTypeChange,
  onBookRouteChange,
  onConversationRoute,
}: UseMarketplaceNavigationOptions) {
  const [view, setView] = useState<MarketplaceView>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(initialDashboardTab);
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const skipNextUrlWriteRef = useRef(false);
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
    if (targetMarket === "book" || targetMarket === "secondhand" || targetMarket === "giveaway") {
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
      setDashboardTab("chats");
      setExpandedConversationId(params.get("conversation"));
      setView("chat");
      const targetConversation = params.get("conversation");
      if (targetConversation && options?.openConversation) {
        void handlersRef.current.onConversationRoute(targetConversation);
      }
      return;
    }

    if (targetView === "dashboard") {
      if (!currentUser) return;
      const targetTab = params.get("tab");
      if (targetTab === "chats") {
        setDashboardTab("chats");
        setExpandedConversationId(params.get("conversation"));
        setView("chat");
        const targetConversation = params.get("conversation");
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

    setSelectedId(null);
    handlersRef.current.onBookRouteChange();
    setView("home");
  }, [currentUser]);

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
      expandedConversationId,
    });
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [currentUser, dashboardTab, expandedConversationId, listingType, ready, selectedId, view]);

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
      expandedConversationId,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentUser, dashboardTab, expandedConversationId]);

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
      expandedConversationId,
    }));
  }, [currentUser, dashboardTab, expandedConversationId, listingType]);

  const openDashboard = useCallback(() => {
    setView("dashboard");
    setDashboardTab("listings");
    setExpandedConversationId(null);
  }, []);

  const returnToChatListRoute = useCallback(() => {
    setDashboardTab("chats");
    setExpandedConversationId(null);
    setView("chat");
    const params = new URLSearchParams(window.location.search);
    params.set("market", listingType);
    params.set("view", "chat");
    params.set("tab", "chats");
    params.delete("conversation");
    window.history.replaceState({}, "", `/?${params.toString()}`);
  }, [listingType]);

  return {
    dashboardTab,
    expandedConversationId,
    openBookRoute,
    openDashboard,
    returnToChatListRoute,
    returnToMarketRoute,
    selectedId,
    setDashboardTab,
    setExpandedConversationId,
    setSelectedId,
    setView,
    view,
  };
}
